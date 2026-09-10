import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  primary: "#1a56db",
  dark: "#111827",
  gray: "#6b7280",
  lightGray: "#e5e7eb",
  white: "#ffffff",
  success: "#059669",
  danger: "#dc2626",
};

export const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: colors.dark,
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: colors.gray,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.dark,
    marginBottom: 6,
    textTransform: "uppercase" as const,
  },
  row: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 4,
  },
  label: {
    color: colors.gray,
    width: 120,
  },
  value: {
    fontWeight: "bold" as const,
    flex: 1,
    textAlign: "right" as const,
  },
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold" as const,
    color: colors.gray,
    textTransform: "uppercase" as const,
  },
  tableRow: {
    flexDirection: "row" as const,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lightGray,
  },
  tableCell: {
    fontSize: 9,
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  footerText: {
    fontSize: 8,
    color: colors.gray,
    lineHeight: 1.4,
  },
  disclaimer: {
    fontSize: 8,
    color: colors.gray,
    fontStyle: "italic" as const,
    marginTop: 8,
    lineHeight: 1.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: "bold" as const,
    color: colors.white,
  },
  badgeIssued: {
    backgroundColor: colors.success,
  },
  badgeInvalidated: {
    backgroundColor: colors.danger,
  },
});
