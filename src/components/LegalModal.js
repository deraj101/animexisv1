/**
 * LegalModal.js
 *
 * A full-screen bottom-sheet style modal that renders one of four legal/info pages:
 *   "terms"   → Terms & Conditions
 *   "privacy" → Privacy Policy
 *   "use"     → Terms of Use
 *   "contact" → Contact Us
 *
 * Usage:
 *   import LegalModal from "../components/LegalModal";
 *
 *   const [legalPage, setLegalPage] = useState(null); // null = closed
 *
 *   <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
 *
 *   // Open:
 *   <TouchableOpacity onPress={() => setLegalPage("terms")}>
 *     <Text>Terms & Conditions</Text>
 *   </TouchableOpacity>
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "../theme";
import ReportModal from "./ReportModal";

// ─── PAGE CONTENT ─────────────────────────────────────────────────────────────

const PAGES = {
  terms: {
    icon: "document-text",
    title: "Terms & Conditions",
    lastUpdated: "January 1, 2025",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: "By accessing or using Animexis (\"the Service\"), you agree to be bound by these Terms & Conditions. If you do not agree to all of the terms, you may not access or use the Service. We reserve the right to update these terms at any time, and your continued use of the Service constitutes acceptance of any changes.",
      },
      {
        heading: "2. Eligibility",
        body: "You must be at least 13 years of age to use the Service. By using Animexis, you represent and warrant that you meet this requirement. Users between 13 and 18 must have parental or guardian consent. We reserve the right to terminate accounts that violate this requirement.",
      },
      {
        heading: "3. Account Registration",
        body: "You must provide a valid email address to register. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. Animexis is not liable for any loss resulting from unauthorized use of your credentials.",
      },
      {
        heading: "4. Permitted Use",
        body: "Animexis grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for personal, non-commercial purposes. You may not reproduce, distribute, publicly display, or create derivative works of any content available through the Service without our express written consent.",
      },
      {
        heading: "5. Prohibited Conduct",
        body: "You agree not to: (a) use the Service for any unlawful purpose; (b) attempt to circumvent any content protection or access control measures; (c) use automated tools or bots to scrape or download content; (d) interfere with or disrupt the integrity or performance of the Service; (e) transmit any harmful, offensive, or disruptive content; or (f) impersonate any person or entity.",
      },
      {
        heading: "6. Intellectual Property",
        body: "All content available on Animexis, including but not limited to anime titles, images, descriptions, and user interface elements, is the property of their respective owners and is protected by applicable intellectual property laws. The Animexis name, logo, and branding are proprietary to us. Unauthorized use of any content or trademarks is strictly prohibited.",
      },
      {
        heading: "7. Disclaimers",
        body: "The Service is provided \"as is\" and \"as available\" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or harmful components. Animexis does not guarantee the accuracy, completeness, or usefulness of any content.",
      },
      {
        heading: "8. Limitation of Liability",
        body: "To the fullest extent permitted by law, Animexis and its affiliates, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Service — even if we have been advised of the possibility of such damages.",
      },
      {
        heading: "9. Termination",
        body: "We reserve the right to suspend or terminate your access to the Service at any time and for any reason, including but not limited to violation of these Terms. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive.",
      },
      {
        heading: "10. Governing Law",
        body: "These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without regard to its conflict of law provisions. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of the Philippines.",
      },
    ],
  },

  privacy: {
    icon: "shield-checkmark",
    title: "Privacy Policy",
    lastUpdated: "January 1, 2025",
    sections: [
      {
        heading: "1. Information We Collect",
        body: "We collect information you provide directly, such as your email address when you register. We also collect information automatically when you use the Service, including your IP address, device type, operating system, browsing behavior within the app, and viewing history. We do not collect payment information — billing is handled entirely by third-party payment processors.",
      },
      {
        heading: "2. How We Use Your Information",
        body: "We use the information we collect to: (a) provide, operate, and improve the Service; (b) send you transactional emails such as your one-time sign-in codes; (c) analyze usage patterns to enhance user experience; (d) enforce our Terms of Service and detect fraudulent activity; and (e) communicate important updates about the Service.",
      },
      {
        heading: "3. Email & Authentication",
        body: "Animexis uses a one-time password (OTP) system for authentication — we do not store passwords. Your email address is used solely to send authentication codes and, where applicable, service notifications. We will never use your email for unsolicited marketing without your explicit consent.",
      },
      {
        heading: "4. Cookies & Tracking",
        body: "We may use session tokens and local device storage to keep you signed in and remember your preferences. These are strictly functional and not used for advertising tracking. We do not use third-party advertising cookies or cross-site tracking technologies.",
      },
      {
        heading: "5. Data Sharing",
        body: "We do not sell, trade, or rent your personal information to third parties. We may share anonymized, aggregated usage data with analytics providers to help us understand how the Service is used. We may disclose your information if required by law or in response to valid legal process.",
      },
      {
        heading: "6. Data Retention",
        body: "We retain your account information for as long as your account is active or as needed to provide the Service. If you request account deletion, we will remove your personal information within 30 days, except where retention is required by law. Anonymized usage data may be retained indefinitely.",
      },
      {
        heading: "7. Data Security",
        body: "We implement industry-standard security measures to protect your personal information, including encrypted transmissions (HTTPS) and secure database storage. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.",
      },
      {
        heading: "8. Children's Privacy",
        body: "Animexis is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information promptly.",
      },
      {
        heading: "9. Your Rights",
        body: "Depending on your jurisdiction, you may have the right to access, correct, or delete your personal information; object to or restrict processing; and data portability. To exercise these rights, contact us at support@animexis.app. We will respond to your request within 30 days.",
      },
      {
        heading: "10. Changes to This Policy",
        body: "We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the \"Last Updated\" date. Your continued use of the Service after changes take effect constitutes your acceptance of the revised policy.",
      },
    ],
  },

  use: {
    icon: "reader",
    title: "Terms of Use",
    lastUpdated: "January 1, 2025",
    sections: [
      {
        heading: "1. Content Access",
        body: "Animexis provides access to anime streaming content for personal, non-commercial viewing. Your access is subject to availability and may vary by region. We reserve the right to modify, suspend, or discontinue any content at any time without notice. Certain content may be age-restricted and requires verification of eligibility.",
      },
      {
        heading: "2. Streaming Quality",
        body: "Streaming quality is determined by your device capabilities and internet connection speed. We strive to provide the best possible experience but cannot guarantee specific resolution or bitrate. We recommend a minimum internet speed of 5 Mbps for HD streaming and 25 Mbps for 4K where available.",
      },
      {
        heading: "3. Simultaneous Streams",
        body: "Free accounts are limited to one simultaneous stream per account. Premium subscribers may stream on up to two devices simultaneously. Sharing account credentials to circumvent these limits is a violation of these Terms and may result in account suspension.",
      },
      {
        heading: "4. Downloads & Offline Viewing",
        body: "Where available, downloads for offline viewing are permitted solely for personal use on authorized devices. Downloaded content may not be transferred, shared, or reproduced in any form. Downloaded content automatically expires 30 days after download or 48 hours after you begin watching, whichever comes first.",
      },
      {
        heading: "5. User-Generated Content",
        body: "If you submit reviews, ratings, comments, or any other content through the Service, you grant Animexis a non-exclusive, royalty-free, perpetual license to use, display, and distribute that content. You are solely responsible for content you submit and agree not to post content that is unlawful, harmful, defamatory, or infringes on third-party rights.",
      },
      {
        heading: "6. Third-Party Links",
        body: "The Service may contain links to third-party websites or services. We are not responsible for the content, privacy practices, or terms of such third parties. Your interactions with third-party sites are solely between you and those sites, and you access them at your own risk.",
      },
      {
        heading: "7. Ad Policy",
        body: "Free tier users will see advertisements during streaming. We use third-party ad networks and are not responsible for the content of advertisements. You may not use ad-blocking software or tools to circumvent ads on free tier accounts. Premium subscribers will not be shown advertisements.",
      },
      {
        heading: "8. Fair Use Policy",
        body: "We monitor accounts for unusual activity, including excessive bandwidth usage or behavior inconsistent with personal viewing. Accounts found to be operating in violation of our fair use policy may have their service suspended or throttled without prior notice.",
      },
      {
        heading: "9. Service Modifications",
        body: "Animexis reserves the right to change, update, or discontinue any aspect of the Service at any time. This includes changes to features, content availability, pricing, and these Terms of Use. Material changes will be communicated to registered users via email or in-app notification.",
      },
      {
        heading: "10. Contact for Abuse",
        body: "If you believe content on Animexis violates copyright or these Terms of Use, please contact us at legal@animexis.app with a detailed description of the issue. We take all reports seriously and will investigate within 5 business days.",
      },
    ],
  },

  contact: {
    icon: "mail",
    title: "Contact Us",
    lastUpdated: null,
    sections: [],
    contact: true,
  },
};

// ─── CONTACT CONTENT ─────────────────────────────────────────────────────────

function ContactContent({ onOpenReport }) {
  const CONTACT_ITEMS = [
    {
      icon: "bug",
      label: "Bug Report & Support",
      value: "Submit a Ticket",
      sub: "Playback issues, app crashes, or general help",
      action: onOpenReport,
    },
    {
      icon: "shield",
      label: "Legal & Copyright",
      value: "legal@animexis.app",
      sub: "DMCA notices and IP concerns",
      action: () => Linking.openURL("mailto:legal@animexis.app"),
    },
    {
      icon: "briefcase",
      label: "Business Inquiries",
      value: "business@animexis.app",
      sub: "Partnerships and licensing",
      action: () => Linking.openURL("mailto:business@animexis.app"),
    },
  ];

  return (
    <View style={contact.wrap}>
      {/* Intro */}
      <View style={contact.intro}>
        <Text style={contact.introText}>
          We'd love to hear from you. Choose the right channel below and we'll
          get back to you as soon as possible.
        </Text>
        <View style={contact.introBadge}>
          <Ionicons name="time-outline" size={13} color={C.crimson} />
          <Text style={contact.introBadgeText}>Typical response time: 24–48 hours</Text>
        </View>
      </View>

      {/* Contact cards */}
      {CONTACT_ITEMS.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={contact.card}
          onPress={item.action}
          activeOpacity={0.7}
        >
          <View style={contact.cardIcon}>
            <Ionicons name={item.icon} size={20} color={C.crimson} />
          </View>
          <View style={contact.cardInfo}>
            <Text style={contact.cardLabel}>{item.label}</Text>
            <Text style={contact.cardValue}>{item.value}</Text>
            <Text style={contact.cardSub}>{item.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.dimmer} />
        </TouchableOpacity>
      ))}

      {/* FAQ note */}
      <View style={contact.faqBox}>
        <Ionicons name="information-circle-outline" size={16} color={C.dim} />
        <Text style={contact.faqText}>
          Before reaching out, check our FAQ — most questions are answered there
          instantly.
        </Text>
      </View>

      {/* Social */}
      <Text style={contact.socialLabel}>Follow us</Text>
      <View style={contact.socialRow}>
        {[
          { icon: "logo-twitter",  label: "@animexis" },
          { icon: "logo-instagram", label: "animexis.app" },
          { icon: "logo-discord",  label: "discord.gg/animexis" },
        ].map((s, i) => (
          <View key={i} style={contact.socialChip}>
            <Ionicons name={s.icon} size={14} color={C.dim} />
            <Text style={contact.socialChipText}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const contact = StyleSheet.create({
  wrap:           { paddingBottom: 8 },
  intro:          { marginBottom: 24, gap: 10 },
  introText:      { color: C.dim, fontSize: 14, lineHeight: 22 },
  introBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: C.crimsonDim, borderWidth: 1, borderColor: C.crimsonBorder,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  introBadgeText: { color: C.crimson, fontSize: 12, fontWeight: "600" },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: C.crimsonDim, borderWidth: 1, borderColor: C.crimsonBorder,
    justifyContent: "center", alignItems: "center",
  },
  cardInfo:   { flex: 1 },
  cardLabel:  { color: C.white, fontSize: 13, fontWeight: "700", marginBottom: 2 },
  cardValue:  { color: C.crimson, fontSize: 12, fontWeight: "600", marginBottom: 2 },
  cardSub:    { color: C.dimmer, fontSize: 11 },

  faqBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, marginTop: 6, marginBottom: 24,
  },
  faqText:      { color: C.dim, fontSize: 12, lineHeight: 18, flex: 1 },

  socialLabel:  { color: C.dim, fontSize: 11, fontWeight: "700", textTransform: "uppercase",
                  letterSpacing: 0.8, marginBottom: 10 },
  socialRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  socialChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  socialChipText: { color: C.dim, fontSize: 12 },
});

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────

export default function LegalModal({ page, onClose }) {
  const [showReport, setShowReport] = useState(false);
  const slideAnim  = useRef(new Animated.Value(600)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  // Keep last valid page so content stays visible during slide-out animation
  const lastPageRef = useRef(page);
  if (page) lastPageRef.current = page;

  const visible = Boolean(page);
  const data    = PAGES[lastPageRef.current] || null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0, tension: 68, friction: 11, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600, duration: 220, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!data) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name={data.icon} size={18} color={C.crimson} />
            </View>
            <View>
              <Text style={styles.headerTitle}>{data.title}</Text>
              {data.lastUpdated && (
                <Text style={styles.headerSub}>Last updated {data.lastUpdated}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={18} color={C.dim} />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Scrollable body */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {data.contact ? (
            <ContactContent onOpenReport={() => setShowReport(true)} />
          ) : (
            data.sections.map((s, i) => (
              <View key={i} style={styles.section}>
                <View style={styles.sectionHeadRow}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionHeading}>{s.heading}</Text>
                </View>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            ))
          )}

          {/* Footer note for legal pages */}
          {!data.contact && (
            <View style={styles.footerNote}>
              <Ionicons name="information-circle-outline" size={14} color={C.dimmer} />
              <Text style={styles.footerNoteText}>
                For questions about this document, contact us at legal@animexis.app
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <ReportModal visible={showReport} onClose={() => setShowReport(false)} />
    </Modal>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "88%",
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },

  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.dimmer,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.5,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.crimsonDim,
    borderWidth: 1,
    borderColor: C.crimsonBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: C.dimmer,
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 20,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 48 : 32,
  },

  section: {
    marginBottom: 22,
  },
  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.crimson,
  },
  sectionHeading: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
    flex: 1,
  },
  sectionBody: {
    color: C.dim,
    fontSize: 13,
    lineHeight: 21,
    paddingLeft: 14,
  },

  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    padding: 14,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  footerNoteText: {
    color: C.dimmer,
    fontSize: 11,
    lineHeight: 17,
    flex: 1,
  },
});