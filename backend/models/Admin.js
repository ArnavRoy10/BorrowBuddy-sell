const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const POWERS = [
    'view_users','edit_users','delete_users',
    'view_items','edit_items','delete_items',
    'view_requests','manage_requests',
    'view_payments','manage_payments',
    'view_reports','manage_admins'
];

const adminSchema = new mongoose.Schema({
    name:      { type:String, required:true, trim:true },
    email:     { type:String, required:true, unique:true, lowercase:true, trim:true },
    password:  { type:String, required:true, minlength:6 },
    role:      { type:String, enum:['super_admin','admin','moderator','viewer'], default:'viewer' },
    powers:    { type:[String], enum:POWERS, default:[] },
    isActive:  { type:Boolean, default:true },
    createdBy: { type:String },
    lastLogin: { type:Date }
}, { timestamps:true });

adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

adminSchema.methods.matchPassword = async function(entered) {
    return bcrypt.compare(entered, this.password);
};

adminSchema.statics.POWERS = POWERS;

module.exports = mongoose.model('Admin', adminSchema);