import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ClientUser from '../models/clientUserModel.js';
import transporter from '../config/mailer.js';

export const signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email and password are required!" });
        }

        const existingUser = await ClientUser.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ success: false, message: "Email already registered!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const activation_token = crypto.randomBytes(32).toString('hex');
        const activation_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const userId = await ClientUser.create({
            name,
            email,
            password: hashedPassword,
            activation_token,
            activation_token_expires
        });

        const activationLink = `https://spade-community.com/activate/${activation_token}`;

        await transporter.sendMail({
            from: `"Spade Community" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Activate Your Spade Community Account",
            html: `
                <p>Dear ${name},</p>
                <p>You recently signed up with Spade Community.</p>
                <p>Please click on the Activation link below to verify your email id.</p>
                <p><a href="${activationLink}">Click here to activate your account.</a></p>
                <p>Activation link: ${activationLink}</p>
                <p>(If you run into any problems, simply copy and paste the entire link into your web browser.)</p>
                <p>By clicking above you will be helping to ensure the highest deliverability of future emails. If you ever change your mind, just let us know by sending mail to support@spade-community.com and we'll stop sending you emails immediately.</p>
                <p>Thank You,<br/>Spade Community</p>
            `
        });

        return res.status(201).json({
            success: true,
            message: "Signup successful! Please check your email to activate your account."
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const activateAccount = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await ClientUser.findByToken(token);
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or already used activation link!" });
        }

        if (new Date(user.activation_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "Activation link expired!" });
        }

        await ClientUser.activateUser(user.id);

        return res.status(200).json({ success: true, message: "Account activated successfully! You can now login." });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const user = await ClientUser.findByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (!user.is_verified) {
            return res.status(403).json({ success: false, message: "Please verify your email before logging in!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            data: { id: user.id, name: user.name, email: user.email }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};