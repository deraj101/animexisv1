import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { C } from "../theme";
import API from "../services/api";

const FEEDBACK_TYPES = [
  { id: "bug", label: "Report a Bug", icon: "bug" },
  { id: "feature", label: "Feature Request", icon: "bulb" },
  { id: "other", label: "Other", icon: "chatbubble-ellipses" },
];

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const [selectedType, setSelectedType] = useState("bug");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert("Hold on!", "Please enter a message before submitting.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await API.post("/api/feedback", {
        type: selectedType,
        message: message.trim(),
      });

      if (res.data?.success) {
        setSubmitted(true);
      } else {
        throw new Error(res.data?.error || "Failed to submit feedback.");
      }
    } catch (error) {
      console.error("Feedback error:", error);
      setErrorMsg(error.response?.data?.error || error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback & Bugs</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {submitted ? (
          <View style={styles.successContainer}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={84} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>Report Submitted!</Text>
            <Text style={styles.successDesc}>
              Thank you for helping us improve Animexis. Our team has been notified and will look into your feedback shortly.
            </Text>
            <TouchableOpacity 
              style={[styles.submitBtn, { width: '100%', marginTop: 24 }]} 
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.submitBtnText}>Return Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Help us improve Animexis! Let us know if you found a bug or have a suggestion.
            </Text>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={C.crimson} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>What kind of feedback?</Text>
            <View style={styles.typeContainer}>
              {FEEDBACK_TYPES.map((type) => {
                const isActive = selectedType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeBtn, isActive && styles.typeBtnActive]}
                    onPress={() => setSelectedType(type.id)}
                  >
                    <Ionicons 
                      name={type.icon} 
                      size={18} 
                      color={isActive ? C.crimson : C.dim} 
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Your Message</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Please provide details..."
                placeholderTextColor={C.dimmer}
                multiline
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={C.white} />
              ) : (
                 <Text style={styles.submitBtnText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.void,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.glass,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  subtitle: {
    fontSize: 14,
    color: C.dim,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.white,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.glass,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnActive: {
    backgroundColor: C.crimsonDim,
    borderColor: C.crimsonBorder,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.dim,
    textAlign: "center",
  },
  typeLabelActive: {
    color: C.crimson,
  },
  inputWrapper: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.glass,
    marginBottom: 32,
    minHeight: 150,
  },
  textInput: {
    flex: 1,
    color: C.white,
    fontSize: 15,
    lineHeight: 22,
    padding: 16,
  },
  submitBtn: {
    backgroundColor: C.crimson,
    borderRadius: 12,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  successIconWrap: {
    marginBottom: 28,
    boxShadow: '0 10px 15px rgba(34,197,94,0.4)',
    elevation: 12,
  },
  successTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
  },
  successDesc: {
    color: C.dim,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220,20,60,0.1)",
    borderWidth: 1,
    borderColor: "rgba(220,20,60,0.3)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: C.crimson,
    fontSize: 13,
    flex: 1,
  },
});
