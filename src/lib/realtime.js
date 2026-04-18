function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForChannelReady(channel, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1500;
  const pollMs = options.pollMs ?? 50;

  if (!channel || typeof channel !== "object") return false;
  if (channel.state === "joined") return true;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(pollMs);
    if (channel.state === "joined") return true;
  }

  return channel.state === "joined";
}

export async function sendBroadcastWhenReady(channel, event, payload, options = {}) {
  if (!channel || typeof channel.send !== "function" || !event) return false;

  const isReady = await waitForChannelReady(channel, options);
  if (!isReady) return false;

  await channel.send({
    type: "broadcast",
    event,
    payload: payload ?? {},
  });

  return true;
}
