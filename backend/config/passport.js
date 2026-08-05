const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
    // ==================== GOOGLE STRATEGY ====================
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('📱 Google Profile:', profile.id, profile.emails[0].value);

            // Check if user already exists with Google ID or email
            let user = await User.findOne({ 
                $or: [
                    { googleId: profile.id },
                    { email: profile.emails[0].value }
                ]
            });

            if (user) {
                console.log('✅ Existing user found:', user.username);
                
                // Update Google ID if not set
                if (!user.googleId) {
                    user.googleId = profile.id;
                    user.provider = 'google';
                    await user.save();
                    console.log('🔄 Updated user with Google ID');
                }
                
                return done(null, user);
            }

            // Create new user
            console.log('🆕 Creating new user from Google account');

            // Generate clean username from email prefix, add short suffix only if taken
            const baseUsername = profile.emails[0].value.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
            const existingUser = await User.findOne({ username: baseUsername });
            const username     = existingUser
                ? baseUsername + Math.floor(Math.random() * 900 + 100)
                : baseUsername;

            user = await User.create({
                googleId:   profile.id,
                username,
                email:      profile.emails[0].value,
                firstName:  profile.name.givenName,
                lastName:   profile.name.familyName,
                avatar:     profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
                provider:   'google',
                isVerified: true
            });

            console.log('✅ New user created:', user.username);
            done(null, user);
        } catch (error) {
            console.error('❌ Google Strategy Error:', error);
            done(error, null);
        }
    }));


    // ==================== SERIALIZATION ====================
    // Serialize user for the session
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Deserialize user from the session
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};