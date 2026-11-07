/** 인증 메일 발송. Resend HTTP API로 보낸다. */
export interface MailSender {
  sendPasswordReset(to: string, url: string): Promise<void>;
}

export interface ResendConfig {
  apiKey: string;
  /** 보내는 사람. 예: "hamsudoku <no-reply@abyssworks.dev>" */
  from: string;
}

const SERVICE_NAME = 'hamsudoku';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function resendSender(config: ResendConfig): MailSender {
  async function send(to: string, subject: string, text: string, html: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${config.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend rejected the mail: ${res.status}`);
  }

  return {
    sendPasswordReset(to, url) {
      const subject = `[${SERVICE_NAME}] 비밀번호 재설정`;
      const text =
        `${SERVICE_NAME} 계정의 비밀번호 재설정을 요청하셨습니다.\n` +
        `아래 링크에서 새 비밀번호를 정해 주세요. 링크는 1시간 동안 유효합니다.\n\n${url}\n\n` +
        '요청하지 않으셨다면 이 메일을 무시해 주세요.';
      const html =
        `<p>${SERVICE_NAME} 계정의 비밀번호 재설정을 요청하셨습니다.</p>` +
        '<p>아래 링크에서 새 비밀번호를 정해 주세요. 링크는 1시간 동안 유효합니다.</p>' +
        `<p><a href="${escapeHtml(url)}">비밀번호 재설정</a></p>` +
        '<p>요청하지 않으셨다면 이 메일을 무시해 주세요.</p>';
      return send(to, subject, text, html);
    },
  };
}
