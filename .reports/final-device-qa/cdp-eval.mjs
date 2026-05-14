import http from "node:http";
import WebSocket from "ws";

const port = Number(process.argv[2]);
const expression = process.argv.slice(3).join(" ");

if (!Number.isFinite(port) || !expression) {
  console.error("Usage: node .reports/final-device-qa/cdp-eval.mjs <port> <expression>");
  process.exit(2);
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${path}`, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

const tabs = await getJson("/json");
const tab = tabs.find((item) => item.type === "page" && item.webSocketDebuggerUrl) || tabs[0];
if (!tab?.webSocketDebuggerUrl) {
  throw new Error("No debuggable WebView page found");
}

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.once("open", resolve);
  ws.once("error", reject);
});

let nextId = 1;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const onMessage = (payload) => {
      const message = JSON.parse(payload);
      if (message.id !== id) return;
      ws.off("message", onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    ws.on("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Runtime.enable");
const result = await send("Runtime.evaluate", {
  expression,
  awaitPromise: true,
  returnByValue: true,
});
const value = result?.result?.value;
if (typeof value === "string") {
  console.log(value);
} else {
  console.log(JSON.stringify(value, null, 2));
}
ws.close();
