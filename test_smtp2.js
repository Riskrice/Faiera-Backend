const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // true for 465
    auth: {
        user: 'support@faiera.com',
        pass: ']L5z8]cs/',
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
});

console.log('Testing SMTP connection with new password...');
transporter.verify()
    .then(() => {
        console.log('✅ SMTP connection successful! Credentials are valid.');
        return transporter.sendMail({
            from: '"Faiera Support" <support@faiera.com>',
            to: 'support@faiera.com',
            subject: 'SMTP Test - ' + new Date().toISOString(),
            text: 'This is a test email to verify the new SMTP password works perfectly.',
        });
    })
    .then((info) => {
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ SMTP FAILED:', err.message);
        process.exit(1);
    });
