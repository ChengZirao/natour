const nodemailer = require('nodemailer');

/**
 *
 * @param {1} options : contains info like receiver's email address, subject of email, content of email, etc.
 */
const sendEmail = async (options) => {
  // 1) Create a transporter, here I use https://mailtrap.io
  const transporter = nodemailer.createTransport({
    // // All the info below is provided by https://mailtrap.io
    // host: process.env.EMAIL_HOST,
    // port: process.env.EMAIL_PORT,
    // auth: {
    //   user: process.env.EMAIL_USERNAME,
    //   pass: process.env.EMAIL_PASSWORD,
    // },

    service: 'outlook',
    auth: {
      user: 'orange_r@outlook.com',
      pass: 'cheng20020709',
    },
  });

  // 2) Define the email options
  const mailOptions = {
    from: 'Zirao Cheng <orange_r@outlook.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // 3) Send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
