const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
        user: 'support@faiera.com',
        pass: 'support@#0M',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
});

console.log('Testing SMTP connection...');
transporter.verify()
    .then(() => {
        console.log('✅ SMTP connection successful! Credentials are valid.');
        console.log('Sending test email...');
        return transporter.sendMail({
            from: '"Faiera Test" <support@faiera.com>',
            to: 'support@faiera.com',
            subject: 'SMTP Test - ' + new Date().toISOString(),
            text: 'This is a test email to verify SMTP is working.',
        });
    })
    .then((info) => {
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ SMTP FAILED:', err.message);
        console.error('Full error:', err);
        process.exit(1);
    });
