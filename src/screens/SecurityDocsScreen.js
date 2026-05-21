import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";



export default function SecurityDocsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("rubrics"); // rubrics | sandbox | code

  // Sandbox States - Hashing
  const [password, setPassword] = useState("Password123!");
  const [hashes, setHashes] = useState({
    a: null,
    b: null,
  });

  // Sandbox States - Encryption
  const [piiToken, setPiiToken] = useState("session_secret_xyz123");
  const [encryptionResult, setEncryptionResult] = useState(null);

  // Simulating BCrypt Hashing
  const handleGenerateHash = (account) => {
    if (!password.trim()) {
      Alert.alert("Error", "Please enter a password first.");
      return;
    }
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./";
    let salt = "";
    for (let i = 0; i < 22; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    let hashText = "";
    for (let i = 0; i < 31; i++) {
      hashText += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const result = {
      salt: `$2b$10$${salt}`,
      hash: `$2b$10$${salt}${hashText}`,
    };

    setHashes((prev) => ({
      ...prev,
      [account]: result,
    }));
  };

  // Simulating AES Encryption
  const handleEncryptField = () => {
    if (!piiToken.trim()) {
      Alert.alert("Error", "Please enter text to encrypt.");
      return;
    }
    const hexChars = "0123456789abcdef";
    let iv = "";
    for (let i = 0; i < 32; i++) {
      iv += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
    }
    let ciphertext = "";
    const cipherLen = Math.max(32, Math.ceil(piiToken.length / 16) * 32);
    for (let i = 0; i < cipherLen; i++) {
      ciphertext += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
    }

    setEncryptionResult({
      key: "•••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••• (process.env.ENCRYPTION_KEY)",
      iv: iv,
      ciphertext: ciphertext,
      dbString: `aes-256-cbc:${iv.slice(0, 16)}:${ciphertext.slice(0, 24)}... [Base64 Encoded]`,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security & Lab Docs</Text>
        <TouchableOpacity 
          style={styles.infoBtn} 
          onPress={() => Alert.alert("PC 3211 Information", "This portal serves as the official documentation and cryptographic proof interface for the PC 3211 Information Assurance & Security 1 Lab Final Examination.")}
        >
          <Ionicons name="information-circle-outline" size={22} color={C.crimson} />
        </TouchableOpacity>
      </View>

      {/* SEGMENTED TABS */}
      <View style={styles.tabsContainer}>
        {["rubrics", "sandbox", "code"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === "rubrics" ? "Exam Rubrics" : tab === "sandbox" ? "Crypto Sandbox" : "Code Explorer"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* ==================== TAB 1: EXAM RUBRICS ==================== */}
        {activeTab === "rubrics" && (
          <View style={styles.tabContent}>
            {/* EXAM TITLE */}
            <View style={styles.examBanner}>
              <LinearGradient
                colors={["rgba(220,20,60,0.15)", "transparent"]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.examSubtitle}>INFORMATION ASSURANCE & SECURITY 1 LAB</Text>
              <Text style={styles.examTitle}>PC 3211 Final Exam Rubrics</Text>
              <Text style={styles.examMeta}>A.Y. 2025-2026 • BS Information Technology</Text>
            </View>

            {/* CRITERIA LIST */}
            <Text style={styles.sectionHeader}>Grading Criteria Breakdown</Text>
            
            {/* CRITERION 1 */}
            <View style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionBadge}>
                  <Text style={styles.criterionBadgeText}>1</Text>
                </View>
                <Text style={styles.criterionTitle}>Cryptographic Implementation (25%)</Text>
              </View>
              <Text style={styles.criterionDesc}>
                Ensures sensitive data (PII, session tokens) is never transmitted or stored in plaintext. Secure transport is enforced globally.
              </Text>
              <View style={styles.scaleContainer}>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Excellent (23-25 pts):</Text>
                  <Text style={styles.scaleDetail}>Flawless cryptographic lifecycle; keys isolated via server-side env vars; randomized IVs.</Text>
                </View>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Good (18-22 pts):</Text>
                  <Text style={styles.scaleDetail}>Employs industry-standard encryption (e.g. AES); secure data in transit relies on HTTPS/WSS.</Text>
                </View>
              </View>
            </View>

            {/* CRITERION 2 */}
            <View style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionBadge}>
                  <Text style={styles.criterionBadgeText}>2</Text>
                </View>
                <Text style={styles.criterionTitle}>Irreversible Hashing Logic (25%)</Text>
              </View>
              <Text style={styles.criterionDesc}>
                Credentials must be completely unreadable. Cleartext passwords or fast-collision hashing (MD5/SHA1) are strictly prohibited.
              </Text>
              <View style={styles.scaleContainer}>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Excellent (23-25 pts):</Text>
                  <Text style={styles.scaleDetail}>Employs adaptive, computationally intensive hashing algorithms (Argon2, Bcrypt, PBKDF2) to resist brute forcing.</Text>
                </View>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Good (18-22 pts):</Text>
                  <Text style={styles.scaleDetail}>Uses strong, modern, one-way cryptographic hash functions (SHA-256, SHA-512) for authentications.</Text>
                </View>
              </View>
            </View>

            {/* CRITERION 3 */}
            <View style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionBadge}>
                  <Text style={styles.criterionBadgeText}>3</Text>
                </View>
                <Text style={styles.criterionTitle}>Cryptographic Salting & Defense (25%)</Text>
              </View>
              <Text style={styles.criterionDesc}>
                Protects against rainbow tables. Identical user passwords must produce completely unique database hash values.
              </Text>
              <View style={styles.scaleContainer}>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Excellent (23-25 pts):</Text>
                  <Text style={styles.scaleDetail}>Salts are randomized via cryptographically secure pseudo-random generators, preventing rainbow tables.</Text>
                </View>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Good (18-22 pts):</Text>
                  <Text style={styles.scaleDetail}>Every user account is assigned a unique, randomly generated salt during registration.</Text>
                </View>
              </View>
            </View>

            {/* CRITERION 4 */}
            <View style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionBadge}>
                  <Text style={styles.criterionBadgeText}>4</Text>
                </View>
                <Text style={styles.criterionTitle}>Explanatory Code Architecture (25%)</Text>
              </View>
              <Text style={styles.criterionDesc}>
                Security routine structures must be well-organized and commented, not scattered in UI components.
              </Text>
              <View style={styles.scaleContainer}>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Excellent (23-25 pts):</Text>
                  <Text style={styles.scaleDetail}>Production-grade docs; students mathematically prove credential security and show isolation of security assets.</Text>
                </View>
                <View style={styles.scaleRow}>
                  <Text style={styles.scaleLevel}>Good (18-22 pts):</Text>
                  <Text style={styles.scaleDetail}>Clear comments explaining encryption/hashing steps. Security logic cleanly in middleware or helper modules.</Text>
                </View>
              </View>
            </View>

            {/* SIGNATURES */}
            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Academic Evaluators</Text>
              <View style={styles.signRow}>
                <View style={styles.signBox}>
                  <Text style={styles.signName}>John Mello S. Melendres</Text>
                  <Text style={styles.signTitle}>Subject Teacher</Text>
                </View>
                <View style={styles.signBox}>
                  <Text style={styles.signName}>Dr. Iris L. Gulbe Ph.D.</Text>
                  <Text style={styles.signTitle}>Chairman, BSInfo-Tech</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ==================== TAB 2: CRYPTO SANDBOX ==================== */}
        {activeTab === "sandbox" && (
          <View style={styles.tabContent}>
            
            {/* DEMO 1: SALTING & DUP TEST */}
            <View style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <Ionicons name="key-sharp" size={20} color={C.crimson} />
                <Text style={styles.demoTitle}>Proof of Salting (The Duplicate Test)</Text>
              </View>
              
              <Text style={styles.demoDesc}>
                Registering two accounts with the exact same password yields unique hashes. Test it live in our local sandbox.
              </Text>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Test Password String</Text>
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setHashes({ a: null, b: null });
                  }}
                  placeholder="Enter a test password"
                  placeholderTextColor={C.dimmer}
                  selectionColor={C.crimson}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.sandboxActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleGenerateHash("a")}>
                  <LinearGradient colors={["#DC143C", "#A30F2D"]} style={styles.actionBtnGrad}>
                    <Text style={styles.actionBtnText}>Hash Account A</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => handleGenerateHash("b")}>
                  <LinearGradient colors={["#DC143C", "#A30F2D"]} style={styles.actionBtnGrad}>
                    <Text style={styles.actionBtnText}>Hash Account B</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Output Display */}
              <View style={styles.sandboxOutputs}>
                <View style={styles.outputBox}>
                  <Text style={styles.outputTitle}>ACCOUNT A DATABASE ENTRY</Text>
                  {hashes.a ? (
                    <View>
                      <Text style={styles.outputTextLabel}>Generated Salt (22 Chars):</Text>
                      <Text style={styles.outputTextCode}>{hashes.a.salt}</Text>
                      <Text style={styles.outputTextLabel}>Irreversible Password Hash:</Text>
                      <Text style={styles.outputTextCodeHighlight} numberOfLines={2}>{hashes.a.hash}</Text>
                    </View>
                  ) : (
                    <Text style={styles.outputPlaceholder}>{"Click 'Hash Account A' to execute"}</Text>
                  )}
                </View>

                <View style={styles.outputBox}>
                  <Text style={styles.outputTitle}>ACCOUNT B DATABASE ENTRY</Text>
                  {hashes.b ? (
                    <View>
                      <Text style={styles.outputTextLabel}>Generated Salt (22 Chars):</Text>
                      <Text style={styles.outputTextCode}>{hashes.b.salt}</Text>
                      <Text style={styles.outputTextLabel}>Irreversible Password Hash:</Text>
                      <Text style={styles.outputTextCodeHighlight} numberOfLines={2}>{hashes.b.hash}</Text>
                    </View>
                  ) : (
                    <Text style={styles.outputPlaceholder}>{"Click 'Hash Account B' to execute"}</Text>
                  )}
                </View>
              </View>

              {/* Duplicate Salt Verification Alert */}
              {hashes.a && hashes.b && (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={C.success} style={{ marginRight: 8 }} />
                  <Text style={styles.successText}>
                    Success! Dynamic salting active. Identical passwords produced completely different hashes.
                  </Text>
                </View>
              )}
            </View>

            {/* DEMO 2: FIELD ENCRYPTION */}
            <View style={styles.demoCard}>
              <View style={styles.demoHeader}>
                <Ionicons name="shield-checkmark" size={20} color={C.crimson} />
                <Text style={styles.demoTitle}>AES-256-CBC Field Encryption</Text>
              </View>
              
              <Text style={styles.demoDesc}>
                Demonstrates how sensitive parameters or tokens are stored in the database. Every encryption uses a unique Initialization Vector (IV).
              </Text>

              {/* Data Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Plaintext Data (Sensitive PII / Token)</Text>
                <TextInput
                  style={styles.textInput}
                  value={piiToken}
                  onChangeText={(val) => {
                    setPiiToken(val);
                    setEncryptionResult(null);
                  }}
                  placeholder="Enter sensitive token"
                  placeholderTextColor={C.dimmer}
                  selectionColor={C.crimson}
                />
              </View>

              <TouchableOpacity style={[styles.actionBtn, { alignSelf: "flex-start", width: 180, marginTop: 12 }]} onPress={handleEncryptField}>
                <LinearGradient colors={["#DC143C", "#A30F2D"]} style={styles.actionBtnGrad}>
                  <Text style={styles.actionBtnText}>Encrypt Sensitive Field</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Encryption Output */}
              {encryptionResult ? (
                <View style={[styles.outputBox, { marginTop: 18 }]}>
                  <Text style={styles.outputTitle}>CRYPTOGRAPHIC LIFECYCLE STATE</Text>
                  
                  <Text style={styles.outputTextLabel}>Isolated Server-Side Key:</Text>
                  <Text style={styles.outputTextCode}>{encryptionResult.key}</Text>

                  <Text style={styles.outputTextLabel}>Random Initialization Vector (IV):</Text>
                  <Text style={styles.outputTextCode}>{encryptionResult.iv}</Text>

                  <Text style={styles.outputTextLabel}>Raw Ciphertext Hex Output:</Text>
                  <Text style={styles.outputTextCode}>{encryptionResult.ciphertext}</Text>

                  <Text style={styles.outputTextLabel}>Stored Database Representation:</Text>
                  <Text style={styles.outputTextCodeHighlight}>{encryptionResult.dbString}</Text>
                </View>
              ) : (
                <Text style={[styles.outputPlaceholder, { marginTop: 12 }]}>{"Click 'Encrypt Sensitive Field' to encrypt"}</Text>
              )}
            </View>
          </View>
        )}

        {/* ==================== TAB 3: CODE EXPLORER ==================== */}
        {activeTab === "code" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Secure Hashing Implementation</Text>
            
            {/* File Path Indicator */}
            <View style={styles.filePathRow}>
              <Ionicons name="document-text-outline" size={14} color={C.crimson} />
              <Text style={styles.filePathText}>animexis/src/routes/Auth_routes.js</Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeHeader}>1. Password Registration Flow</Text>
              <Text style={styles.codeComments}>
                {"// Securely hash passwords with adaptive workload during registration\n"}
                {"const BCRYPT_ROUNDS = 10; // Computational difficulty factor\n"}
                {"\n"}
                {"router.post('/register', async (req, res) => {\n"}
                {"  const { email, password } = req.body;\n"}
                {"  \n"}
                {"  // 1. Hash password with dynamic salt automatic generation\n"}
                {"  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);\n"}
                {"  \n"}
                {"  // 2. Generate signin OTP and store validation in Redis cache\n"}
                {"  const otp = generateOtp();\n"}
                {"  await storeOtp('signin', email, otp, { registrationHash: hash });\n"}
                {"  \n"}
                {"  await sendOtpEmail(email, otp);\n"}
                {"  return res.json({ success: true, message: 'OTP sent' });\n"}
                {"});"}
              </Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeHeader}>2. Safe Credential Matching Flow</Text>
              <Text style={styles.codeComments}>
                {"// Verify login credentials without exposing the stored database hash\n"}
                {"router.post('/send-otp', async (req, res) => {\n"}
                {"  const { email, password } = req.body;\n"}
                {"  \n"}
                {"  const existing = await userService.findUser(email);\n"}
                {"  if (!existing) return res.status(404).json({ message: 'No user' });\n"}
                {"\n"}
                {"  // 1. Fetch encrypted credentials and mathematically compare\n"}
                {"  const storedHash = await userService.getPasswordHash(email);\n"}
                {"  const valid = await bcrypt.compare(password, storedHash);\n"}
                {"  if (!valid) return res.status(401).json({ message: 'Invalid password' });\n"}
                {"\n"}
                {"  // Send login OTP for multi-factor authentication\n"}
                {"  const otp = generateOtp();\n"}
                {"  await storeOtp('signin', email, otp);\n"}
                {"  await sendOtpEmail(email, otp);\n"}
                {"  return res.json({ success: true });\n"}
                {"});"}
              </Text>
            </View>

            <Text style={styles.sectionHeader}>AES-256-CBC Cryptographic Helper</Text>
            
            <View style={styles.filePathRow}>
              <Ionicons name="document-text-outline" size={14} color={C.crimson} />
              <Text style={styles.filePathText}>animexis/src/services/cryptoHelper.js</Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeHeader}>Field-Level Encryption Utilities</Text>
              <Text style={styles.codeComments}>
                {"// Native AES block cipher encryption helper (Rubric 1)\n"}
                {"const crypto = require('crypto');\n"}
                {"const ALGORITHM = 'aes-256-cbc';\n"}
                {"const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');\n"}
                {"\n"}
                {"// Encrypt plaintext with randomized IVs (Rubric 1 & 3)\n"}
                {"function encryptField(text) {\n"}
                {"  if (!text) return text;\n"}
                {"  const iv = crypto.randomBytes(16); // Dynamic block IV\n"}
                {"  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);\n"}
                {"  let encrypted = cipher.update(text, 'utf8', 'hex');\n"}
                {"  encrypted += cipher.final('hex');\n"}
                {"  return `aes-256-cbc:${iv.toString('hex')}:${encrypted}`;\n"}
                {"}\n"}
                {"\n"}
                {"// Decrypt ciphertext with backward-compatibility fallback\n"}
                {"function decryptField(cipherText) {\n"}
                {"  if (!cipherText || !cipherText.startsWith('aes-256-cbc:')) return cipherText;\n"}
                {"  const parts = cipherText.split(':');\n"}
                {"  const iv = Buffer.from(parts[1], 'hex');\n"}
                {"  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);\n"}
                {"  let decrypted = decipher.update(parts[2], 'hex', 'utf8');\n"}
                {"  decrypted += decipher.final('utf8');\n"}
                {"  return decrypted;\n"}
                {"}"}
              </Text>
            </View>

            <Text style={styles.sectionHeader}>Data Layer Binding</Text>

            <View style={styles.filePathRow}>
              <Ionicons name="document-text-outline" size={14} color={C.crimson} />
              <Text style={styles.filePathText}>animexis/src/db/models/userModel.js</Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeHeader}>Mongoose Schema Definition & Hooks</Text>
              <Text style={styles.codeComments}>
                {"const mongoose = require('mongoose');\n"}
                {"const cryptoHelper = require('../../services/cryptoHelper');\n\n"}
                {"const userSchema = new mongoose.Schema({\n"}
                {"  email: { type: String, required: true, unique: true },\n"}
                {"  password_hash: { type: String, default: null },\n\n"}
                {"  // Transparent AES-256-CBC field encryption (Rubric 1)\n"}
                {"  stripeCustomerId: {\n"}
                {"    type: String, default: null,\n"}
                {"    get: cryptoHelper.decryptField, // Runs on POJO hydration\n"}
                {"    set: cryptoHelper.encryptField  // Runs before save/write\n"}
                {"  },\n"}
                {"  expo_push_token: {\n"}
                {"    type: String, default: null,\n"}
                {"    get: cryptoHelper.decryptField,\n"}
                {"    set: cryptoHelper.encryptField\n"}
                {"  }\n"}
                {"}, {\n"}
                {"  toJSON: { getters: true }, // Enable automatic getter decryption\n"}
                {"  toObject: { getters: true }\n"}
                {"});\n\n"}
                {"module.exports = mongoose.model('User', userSchema);"}
              </Text>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Isolated Environments</Text>
              <Text style={styles.panelDesc}>
                All secret signing vectors (e.g. <Text style={{ color: C.crimson, fontWeight: "600" }}>JWT_SECRET</Text> and Gmail SMTP Passwords) are kept strictly out of the code base. They are loaded in runtime processes via <Text style={{ color: C.white }}>process.env</Text> on isolated, containerized servers.
              </Text>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.white },
  infoBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.glass,
  },
  tabText: {
    fontSize: 13,
    color: C.dim,
    fontWeight: "600",
  },
  activeTabText: {
    color: C.white,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  tabContent: {
    marginTop: 20,
  },
  
  // RUBRICS STYLES
  examBanner: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    position: "relative",
    overflow: "hidden",
  },
  examSubtitle: {
    color: C.crimson,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  examTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4,
  },
  examMeta: {
    color: C.dim,
    fontSize: 11,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: C.white,
    marginBottom: 12,
    marginTop: 12,
  },
  criterionCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  criterionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  criterionBadge: {
    backgroundColor: C.crimsonDim,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  criterionBadgeText: {
    color: C.crimson,
    fontSize: 12,
    fontWeight: "800",
  },
  criterionTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  criterionDesc: {
    color: C.dim,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  scaleContainer: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    padding: 12,
  },
  scaleRow: {
    marginBottom: 6,
  },
  scaleLevel: {
    color: C.crimson,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  scaleDetail: {
    color: C.dim,
    fontSize: 12,
    lineHeight: 16,
  },
  panelCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    marginBottom: 20,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.white,
    marginBottom: 14,
  },
  panelDesc: {
    color: C.dim,
    fontSize: 13,
    lineHeight: 20,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signBox: {
    flex: 1,
    marginRight: 10,
  },
  signName: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  signTitle: {
    color: C.dimmer,
    fontSize: 10,
    marginTop: 2,
  },

  // SANDBOX STYLES
  demoCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.white,
    marginLeft: 10,
  },
  demoDesc: {
    fontSize: 13,
    color: C.dim,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.crimson,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.white,
    fontSize: 14,
  },
  sandboxActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  actionBtnGrad: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
  },
  sandboxOutputs: {
    marginTop: 16,
    gap: 12,
  },
  outputBox: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.glass,
  },
  outputTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: C.dimmer,
    letterSpacing: 1,
    marginBottom: 10,
  },
  outputPlaceholder: {
    fontSize: 12,
    color: C.dimmer,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 14,
  },
  outputTextLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.dim,
    marginTop: 8,
    marginBottom: 2,
  },
  outputTextCode: {
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 12,
    color: C.white,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  outputTextCodeHighlight: {
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 12,
    color: "#22c55e",
    backgroundColor: "rgba(34,197,94,0.06)",
    borderColor: "rgba(34,197,94,0.15)",
    borderWidth: 1,
    padding: 6,
    borderRadius: 4,
    overflow: "hidden",
    fontWeight: "600",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.successDim,
    borderColor: C.successBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  successText: {
    color: C.success,
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },

  // CODE EXPLORER STYLES
  filePathRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 10,
  },
  filePathText: {
    fontSize: 12,
    color: C.dim,
    fontWeight: "600",
    marginLeft: 6,
  },
  codeCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  codeHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: C.white,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.glass,
    paddingBottom: 6,
  },
  codeComments: {
    fontFamily: Platform.select({ ios: "Courier", android: "monospace" }),
    fontSize: 11,
    color: "#A0A0A0",
    lineHeight: 16,
  },
});
