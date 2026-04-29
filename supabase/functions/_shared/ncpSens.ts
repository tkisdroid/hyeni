type SignatureInput = {
  method: string;
  uri: string;
  timestamp: string;
  accessKey: string;
};

type SmsBodyInput = {
  from: string;
  to: string;
  otp: string;
};

type SendOtpInput = {
  accessKey: string;
  secretKey: string;
  serviceId: string;
  from: string;
  to: string;
  otp: string;
};

const NCP_SENS_HOST = "https://sens.apigw.ntruss.com";

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function requireNonBlank(value: string, errorCode: string) {
  if (!String(value || "").trim()) {
    throw new Error(errorCode);
  }
}

function base64Encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function normalizePhoneForNcpSens(phone: string) {
  const raw = String(phone || "").trim();
  const digits = digitsOnly(raw);

  if (raw.startsWith("+82") && /^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^010\d{8}$/.test(digits)) {
    return digits;
  }

  throw new Error("invalid_phone");
}

export function buildNcpSensSignatureMessage(input: SignatureInput) {
  return `${input.method} ${input.uri}\n${input.timestamp}\n${input.accessKey}`;
}

export async function createNcpSensSignature(input: SignatureInput & { secretKey: string }) {
  requireNonBlank(input.secretKey, "invalid_secret_key");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(buildNcpSensSignatureMessage(input)),
  );

  return base64Encode(new Uint8Array(signature));
}

export function buildNcpSensSmsBody(input: SmsBodyInput) {
  const from = digitsOnly(input.from);
  const otp = String(input.otp || "").trim();

  if (!from) {
    throw new Error("invalid_from_number");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("invalid_otp");
  }

  return {
    type: "SMS",
    contentType: "COMM",
    countryCode: "82",
    from,
    content: `[혜니캘린더] 인증번호는 ${otp} 입니다.`,
    messages: [{ to: normalizePhoneForNcpSens(input.to) }],
  };
}

export async function sendNcpSensOtp(input: SendOtpInput) {
  requireNonBlank(input.accessKey, "invalid_access_key");
  requireNonBlank(input.secretKey, "invalid_secret_key");
  requireNonBlank(input.serviceId, "invalid_service_id");

  const method = "POST";
  const uri = `/sms/v2/services/${input.serviceId}/messages`;
  const timestamp = String(Date.now());
  const signature = await createNcpSensSignature({
    method,
    uri,
    timestamp,
    accessKey: input.accessKey,
    secretKey: input.secretKey,
  });

  const response = await fetch(`${NCP_SENS_HOST}${uri}`, {
    method,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "x-ncp-apigw-timestamp": timestamp,
      "x-ncp-iam-access-key": input.accessKey,
      "x-ncp-apigw-signature-v2": signature,
    },
    body: JSON.stringify(buildNcpSensSmsBody({
      from: input.from,
      to: input.to,
      otp: input.otp,
    })),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ncp_sens_${response.status}: ${text.slice(0, 300)}`);
  }

  return response;
}
