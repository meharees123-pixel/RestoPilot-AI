const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const path = require("node:path");

try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch (error) {
  if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
}

const { User, UserRole, UserSchema, UserStatus } = require("../dist/src/modules/auth/user.schema");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

async function seedSuperAdmin() {
  const uri = required("MONGODB_URI");
  const firstName = required("SEED_SUPER_ADMIN_FIRST_NAME");
  const lastName = required("SEED_SUPER_ADMIN_LAST_NAME");
  const phoneNumber = required("SEED_SUPER_ADMIN_PHONE_NUMBER");
  const email = required("SEED_SUPER_ADMIN_EMAIL").toLowerCase();
  const password = required("SEED_SUPER_ADMIN_PASSWORD");
  const mfaSecret = required("SEED_SUPER_ADMIN_MFA_SECRET").replace(/\s/g, "").toUpperCase();
  if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
    throw new Error("SEED_SUPER_ADMIN_PHONE_NUMBER must be in E.164 format");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL must be a valid email address");
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be between 12 and 128 characters");
  }
  if (!/^[A-Z2-7]+=*$/.test(mfaSecret) || mfaSecret.replace(/=/g, "").length < 16) {
    throw new Error("SEED_SUPER_ADMIN_MFA_SECRET must be a Base32 secret of at least 16 characters");
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DATABASE || "RestoPilot" });
  const UserModel = mongoose.model(User.name, UserSchema);
  try {
    if (await UserModel.exists({ $or: [{ email }, { phoneNumber }] })) {
      throw new Error("A user with the configured super-admin email or phone already exists");
    }
    await UserModel.create({
      firstName,
      lastName,
      phoneNumber,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      mfaSecret,
      role: UserRole.SUPER_ADMIN,
      restaurantId: null,
      branchIds: [],
      status: UserStatus.ACTIVE,
      isWhatsappVerified: false,
    });
    process.stdout.write(`Created super-admin account ${email}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

seedSuperAdmin().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
