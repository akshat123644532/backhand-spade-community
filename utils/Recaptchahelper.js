// Verifies a reCAPTCHA v2 token sent from the frontend against Google's siteverify API.
// Requires RECAPTCHA_SECRET_KEY to be set in .env

export const verifyRecaptcha = async (token) => {
    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: secretKey,
                response: token
            })
        });

        const data = await response.json();
        return data.success === true;

    } catch (error) {
        console.error("RECAPTCHA VERIFY ERROR:", error);
        return false;
    }
};