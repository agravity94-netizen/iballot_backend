import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailService = {
  sendAppealResolution: async (email: string, status: 'GRANTED' | 'REJECTED', notes?: string) => {
    const subject = `iBallot: Your Appeal Decision - ${status}`;
    const message = status === 'GRANTED'
      ? `<div style="font-family: sans-serif; color: #1a1a1a;">
          <h2 style="color: #16a34a;">Appeal Granted</h2>
          <p>We are pleased to inform you that your appeal has been reviewed and <strong>GRANTED</strong>.</p>
          <p>Your account status has been updated to <strong>Approved</strong> automatically.</p>
          ${notes ? `<p><strong>Admin Remarks:</strong> ${notes}</p>` : ''}
          <p>You can now proceed with the next steps in the iBallot app.</p>
        </div>`
      : `<div style="font-family: sans-serif; color: #1a1a1a;">
          <h2 style="color: #dc2626;">Appeal Rejected</h2>
          <p>Your appeal has been reviewed by the Electoral Commission.</p>
          <p>Unfortunately, the original decision has been <strong>MAINTAINED</strong> and your appeal is rejected.</p>
          ${notes ? `<p><strong>Admin Remarks:</strong> ${notes}</p>` : ''}
          <p>This decision is final under Section 14-C of the Voting Guidelines.</p>
        </div>`;

    try {
      await transporter.sendMail({
        from: `"iBallot Commission" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html: message,
      });
      console.log(`[EMAIL] Appeal resolution sent to ${email}`);
    } catch (error) {
      console.error(`[EMAIL] Failed to send resolution email to ${email}:`, error);
    }
  }
};
