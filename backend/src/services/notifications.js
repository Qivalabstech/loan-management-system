const { sendMail } = require('../config/email');

const templates = {
  submitted: (name, appNum) => ({
    subject: `Loan Application ${appNum} Received`,
    html: `<p>Dear ${name},</p><p>Your loan application <strong>${appNum}</strong> has been received and is under review. We will update you on the status shortly.</p><p>Regards,<br/>LMS Team</p>`
  }),
  approved: (name, appNum, amount) => ({
    subject: `Loan Application ${appNum} Approved!`,
    html: `<p>Dear ${name},</p><p>Congratulations! Your loan application <strong>${appNum}</strong> for <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> has been <strong>approved</strong>. Our team will contact you for disbursement.</p><p>Regards,<br/>LMS Team</p>`
  }),
  rejected: (name, appNum, reason) => ({
    subject: `Loan Application ${appNum} Update`,
    html: `<p>Dear ${name},</p><p>We regret to inform you that your loan application <strong>${appNum}</strong> could not be approved at this time.</p><p><strong>Reason:</strong> ${reason}</p><p>You may re-apply after 6 months or contact us for alternative options.</p><p>Regards,<br/>LMS Team</p>`
  }),
  disbursed: (name, appNum, amount, accNum) => ({
    subject: `Loan Disbursed - Account ${accNum}`,
    html: `<p>Dear ${name},</p><p>Your loan of <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> (Application: ${appNum}) has been disbursed. Your loan account number is <strong>${accNum}</strong>.</p><p>Regards,<br/>LMS Team</p>`
  }),
  paymentReceived: (name, amount, accNum, balance) => ({
    subject: `Payment Received - Loan ${accNum}`,
    html: `<p>Dear ${name},</p><p>Payment of <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> received for loan account <strong>${accNum}</strong>. Outstanding balance: <strong>₹${Number(balance).toLocaleString('en-IN')}</strong>.</p><p>Regards,<br/>LMS Team</p>`
  }),
  emiOverdue: (name, accNum, dueDate, amount) => ({
    subject: `EMI Overdue - Loan ${accNum}`,
    html: `<p>Dear ${name},</p><p>Your EMI of <strong>₹${Number(amount).toLocaleString('en-IN')}</strong> due on <strong>${dueDate}</strong> for loan <strong>${accNum}</strong> is overdue. Please make the payment at the earliest to avoid penalties.</p><p>Regards,<br/>LMS Team</p>`
  }),
};

async function notify(type, email, ...args) {
  if (!email) return;
  const tmpl = templates[type]?.(...args);
  if (tmpl) await sendMail(email, tmpl.subject, tmpl.html);
}

module.exports = { notify };
