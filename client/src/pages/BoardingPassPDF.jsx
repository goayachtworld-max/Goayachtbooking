import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Line,
  Svg,
  Link,
} from "@react-pdf/renderer";
import { useState } from "react";

/* ===================== HELPERS ===================== */

const sanitizeText = (text = "") =>
  text
    .replace(/\u2022|\u2023|\u25E6/g, "-")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

const formatTo12Hour = (time) => {
  if (!time) return "";
  const [hourStr, minute] = time.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/* ===================== THEME ===================== */
const NAVY = "#0D2137";   // deep ocean blue (warmer)
const GOLD = "#D4A843";   // warmer gold
const GOLD2 = "#F0C96B";
const TEAL = "#0E8A7A";   // fresh teal for included services
const AMBER = "#D97706";   // amber for paid add-ons
const LIGHT = "#F4F7FB";
const MUTED = "#8A98AC";
const WHITE = "#FFFFFF";
const BORDER = "#DDE3ED";
const CREAM = "#FDFAF2";

/* ===================== STYLES ===================== */
const S = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#D6E4F0",
    fontFamily: "Helvetica",
  },

  /* ── OUTER CARD ── */
  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    overflow: "hidden",
    border: `1 solid ${BORDER}`,
  },

  /* ── HEADER BAND ── */
  header: {
    backgroundColor: NAVY,
    padding: "14 20 12 20",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flexDirection: "column" },
  companyName: {
    color: GOLD,
    fontSize: 11,
    letterSpacing: 3,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  boardingTitle: {
    color: WHITE,
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  headerRight: { alignItems: "flex-end" },
  ticketLabel: { color: MUTED, fontSize: 8, letterSpacing: 1 },
  ticketId: {
    color: GOLD2,
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: GOLD,
    borderRadius: 4,
    padding: "2 8",
    marginTop: 4,
  },
  statusText: {
    color: NAVY,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },

  /* ── GOLD ACCENT LINE ── */
  accentStripe: {
    backgroundColor: GOLD,
    height: 3,
  },

  /* ── BODY ── */
  body: { padding: "14 20 16 20" },

  /* ── SECTION TITLE ── */
  sectionTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
    borderBottom: `1 solid ${GOLD}`,
    paddingBottom: 3,
  },

  /* ── INFO GRID ── */
  row: {
    flexDirection: "row",
    marginBottom: 10,
    gap: 12,
  },
  col: { flex: 1 },
  label: {
    fontSize: 7.5,
    color: MUTED,
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: "Helvetica",
  },
  value: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    lineHeight: 1.2,
  },

  /* ── HIGHLIGHT BOX (time / date) ── */
  highlightBox: {
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: "8 12",
    flex: 1,
  },
  highlightLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 0.5 },
  highlightValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    marginTop: 2,
  },
  highlightSub: { fontSize: 8.5, color: GOLD2, marginTop: 1 },

  /* ── PERFORATED DIVIDER ── */
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  perfCircleLeft: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D6E4F0",
    marginLeft: -28,
  },
  perfCircleRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#D6E4F0",
    marginRight: -28,
  },
  perfLine: {
    flex: 1,
    borderBottom: `1.5 dashed ${BORDER}`,
    marginHorizontal: 4,
  },

  /* ── PAYMENT STRIP ── */
  paymentStrip: {
    backgroundColor: CREAM,
    border: `1 solid ${GOLD}`,
    borderRadius: 8,
    padding: "10 14",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  paymentBlock: { flex: 1 },
  paymentLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 0.5 },
  paymentValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    marginTop: 2,
  },
  paymentDivider: {
    width: 1,
    backgroundColor: BORDER,
    height: 30,
    marginHorizontal: 10,
  },
  pendingValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#C0392B",
    marginTop: 2,
  },

  /* ── SERVICES ── */
  servicesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  serviceCol: { flex: 1 },
  serviceColHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  serviceColDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  serviceColLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 3,
    borderRadius: 5,
    borderLeftWidth: 3,
  },
  serviceItemIncluded: {
    backgroundColor: "#F0FDF9",
    borderLeftColor: TEAL,
  },
  serviceItemPaid: {
    backgroundColor: "#FFFBEB",
    borderLeftColor: AMBER,
  },
  serviceItemText: {
    fontSize: 8.5,
    lineHeight: 1.2,
  },
  serviceItemTextIncluded: { color: "#065F52" },
  serviceItemTextPaid: { color: "#92400E" },

  /* ── NOTES ── */
  notesBox: {
    backgroundColor: "#FFFDF5",
    border: `1 solid ${GOLD}`,
    borderRadius: 7,
    padding: "7 10",
    marginBottom: 12,
  },
  notesText: { fontSize: 9, color: "#5A4A1A", lineHeight: 1.4 },

  /* ── DISCLAIMER ── */
  disclaimerBox: {
    backgroundColor: LIGHT,
    border: `1 solid ${BORDER}`,
    borderRadius: 7,
    padding: "8 10",
    marginBottom: 10,
  },
  disclaimerLine: {
    fontSize: 8,
    color: "#64748B",
    lineHeight: 1.5,
    marginBottom: 1,
  },

  /* ── RECEIPT LINK STRIP ── */
  receiptStrip: {
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: "10 16",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  receiptStripLeft: { flexDirection: "column" },
  receiptStripLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1, marginBottom: 2 },
  receiptStripTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE },
  receiptStripLink: {
    backgroundColor: GOLD,
    borderRadius: 5,
    padding: "5 12",
  },
  receiptStripLinkText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 0.5,
  },

  /* ── RECEIPT LINK STRIP ── */
  receiptStrip: {
    backgroundColor: NAVY,
    borderRadius: 8,
    padding: "10 16",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  receiptStripLeft: { flexDirection: "column" },
  receiptStripLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1, marginBottom: 2 },
  receiptStripTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE },
  receiptStripBtn: {
    backgroundColor: GOLD,
    borderRadius: 5,
    padding: "5 12",
  },
  receiptStripBtnText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    letterSpacing: 0.5,
  },

  /* ── FOOTER STAMP ── */
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `1 solid ${BORDER}`,
    paddingTop: 8,
    marginTop: 4,
  },
  footerText: { fontSize: 7.5, color: MUTED, fontStyle: "italic" },
  footerBrand: { fontSize: 8, color: NAVY, fontFamily: "Helvetica-Bold" },
});

/* ===================== SUB-COMPONENTS ===================== */

const InfoField = ({ label, value }) => (
  <View style={S.col}>
    <Text style={S.label}>{label}</Text>
    <Text style={S.value}>{value || "—"}</Text>
  </View>
);

const HighlightBox = ({ label, value, sub }) => (
  <View style={S.highlightBox}>
    <Text style={S.highlightLabel}>{label}</Text>
    <Text style={S.highlightValue}>{value || "—"}</Text>
    {sub ? <Text style={S.highlightSub}>{sub}</Text> : null}
  </View>
);

const Perforated = () => (
  <View style={S.perfRow}>
    <View style={S.perfCircleLeft} />
    <View style={S.perfLine} />
    <View style={S.perfCircleRight} />
  </View>
);

const ServiceItem = ({ text, type }) => {
  const isIncluded = type === "included";
  return (
    <View style={[S.serviceItem, isIncluded ? S.serviceItemIncluded : S.serviceItemPaid]}>
      <Text style={[S.serviceItemText, isIncluded ? S.serviceItemTextIncluded : S.serviceItemTextPaid]}>
        {text}
      </Text>
    </View>
  );
};

/* ===================== MAIN COMPONENT ===================== */

export default function BoardingPassPDF({ booking }) {
  if (!booking) return null;

  const ticket = booking._id.slice(-5).toUpperCase();
  const isPending = booking.status === "pending";

  const storedUser = localStorage.getItem("user");
  const [user] = useState(storedUser ? JSON.parse(storedUser) : null);
  const role = user?.type?.toLowerCase();

  /* ── PARSE EXTRA DETAILS ── */
  const extraDetails = sanitizeText(booking.extraDetails || "");

  const inclusions = extraDetails
    ? extraDetails.split("\n").filter((i) =>
      ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"].some(
        (k) => i.includes(k)
      )
    )
    : [];

  const paidServices = extraDetails
    ? extraDetails.split("\n").filter((i) =>
      ["Drone - Photography & Videography", "DSLR Photography"].some((k) => i.includes(k))
    )
    : [];

  const notes = extraDetails.includes("Notes:")
    ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
    : "";

  const disclaimerText = sanitizeText(
    booking?.company?.disclaimer
      ? `${booking.company.disclaimer}[${ticket}]`
      : `Reporting time is 30 minutes prior to departure\nNo refund for late arrival or no-show\nSubject to weather and government regulations\nThank you for booking with ${booking.company?.name}`
  );
  const disclaimerLines = disclaimerText.split("\n").map((l) => l.trim()).filter(Boolean);

  /* ── SMART TRUNCATION ── */
  const safeInclusions = inclusions.slice(0, 6);
  const safePaidServices = paidServices.slice(0, 6);
  const safeDisclaimer = disclaimerLines.slice(0, 8);

  /* ── PAYMENT ── */
  const tokenAmt = booking?.transactionIds?.[0]?.amount;

  return (
    <Document>
      <Page size="A4" style={S.page} wrap={false}>
        <View style={S.card} wrap={false}>

          {/* ══ HEADER ══ */}
          <View style={S.header}>
            <View style={S.headerLeft}>
              <Text style={S.companyName}>
                {booking.company?.name?.toUpperCase() || "COMPANY"}
              </Text>
              <Text style={S.boardingTitle}>{isPending ? "TENTATIVE PASS" : "BOARDING PASS"}</Text>
            </View>
            <View style={S.headerRight}>
              <Text style={S.ticketLabel}>TICKET ID</Text>
              <Text style={S.ticketId}>{ticket}</Text>
              <View style={S.statusBadge}>
                <Text style={S.statusText}>{booking.status?.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Gold stripe */}
          <View style={S.accentStripe} />

          {/* ══ BODY ══ */}
          <View style={S.body}>

            {/* ── SECTION: Guest & Journey ── */}
            <Text style={S.sectionTitle}>Guest & Journey</Text>

            <View style={S.row}>
              <InfoField label="PASSENGER NAME" value={booking.customerId?.name} />
              <View style={S.col}>
                <Text style={S.label}>CONTACT NUMBER</Text>
                {booking.customerId?.contact ? (
                  <Link src={`tel:${booking.customerId.contact}`} style={[S.value, { color: NAVY, textDecoration: "none" }]}>
                    {booking.customerId.contact}
                  </Link>
                ) : (
                  <Text style={S.value}>—</Text>
                )}
              </View>
              <InfoField label="YACHT" value={booking.yachtId?.name} />
              <InfoField label="GUESTS" value={`${booking.numPeople} Pax`} />
            </View>

            {/* Highlighted date + time boxes */}
            <View style={[S.row, { gap: 10, marginBottom: 10 }]}>
              <HighlightBox
                label="SAILING DATE"
                value={formatDate(booking.date)}
              />
              <HighlightBox
                label="DEPARTURE"
                value={formatTo12Hour(booking.startTime)}
                sub={`Until ${formatTo12Hour(booking.endTime)}`}
              />
              <View style={[S.col, { flex: 2 }]}>
                <Text style={S.label}>BOARDING LOCATION</Text>
                {isPending ? (
                  <Text style={[S.value, { fontSize: 10, marginTop: 3, color: NAVY }]}>
                    Will be shared upon confirmation
                  </Text>
                ) : booking.yachtId?.boardingLocation ? (
                  <Link
                    src={booking.yachtId.boardingLocation}
                    style={[S.value, { fontSize: 10, marginTop: 3, color: "#1A56DB", textDecoration: "underline" }]}
                  >
                    Location
                  </Link>
                ) : (
                  <Text style={[S.value, { fontSize: 10, marginTop: 3, color: NAVY }]}>
                    Location not provided
                  </Text>
                )}
              </View>
            </View>

            {/* ── PERFORATED TEAR LINE ── */}
            <Perforated />

            {/* ── SECTION: Contact Person (confirmed only) ── */}
            {!isPending && (booking.yachtId?.contactPersonName || booking.yachtId?.contactPersonNumber) && (
              <>
                <Text style={S.sectionTitle}>Yacht Contact</Text>
                <View style={[S.row, { marginBottom: 12 }]}>
                  {booking.yachtId?.contactPersonName && (
                    <InfoField label="CONTACT PERSON" value={booking.yachtId.contactPersonName} />
                  )}
                  {booking.yachtId?.contactPersonNumber && (
                    <View style={S.col}>
                      <Text style={S.label}>CONTACT NUMBER</Text>
                      <Link
                        src={`tel:${booking.yachtId.contactPersonNumber}`}
                        style={[S.value, { color: NAVY, textDecoration: "none" }]}
                      >
                        {booking.yachtId.contactPersonNumber}
                      </Link>
                    </View>
                  )}
                  <View style={S.col} />
                </View>
              </>
            )}

            {/* ── SECTION: Payment ── */}
            {!isPending && (
              <>
                <Text style={S.sectionTitle}>Payment Summary</Text>
                {role === "admin" ? (
                  <View style={S.paymentStrip}>
                    <View style={S.paymentBlock}>
                      <Text style={S.paymentLabel}>BOOKING AMOUNT</Text>
                      <Text style={S.paymentValue}>{booking.quotedAmount}/-</Text>
                    </View>
                    <View style={S.paymentDivider} />
                    <View style={S.paymentBlock}>
                      <Text style={S.paymentLabel}>TOKEN PAID</Text>
                      <Text style={S.paymentValue}>{tokenAmt}/-</Text>
                    </View>
                    <View style={S.paymentDivider} />
                    <View style={S.paymentBlock}>
                      <Text style={S.paymentLabel}>PENDING BALANCE</Text>
                      <Text style={S.pendingValue}>{booking.pendingAmount}/-</Text>
                    </View>
                  </View>
                ) : (
                  <View style={S.paymentStrip}>
                    <View style={S.paymentBlock}>
                      <Text style={S.paymentLabel}>PENDING BALANCE</Text>
                      <Text style={S.pendingValue}>{booking.pendingAmount}/-</Text>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* ── SECTION: Services ── */}
            {(safeInclusions.length > 0 || safePaidServices.length > 0) && (
              <>
                <Text style={S.sectionTitle}>Services</Text>
                <View style={S.servicesRow}>
                  {safeInclusions.length > 0 && (
                    <View style={S.serviceCol}>
                      <View style={S.serviceColHeader}>
                        <View style={[S.serviceColDot, { backgroundColor: TEAL }]} />
                        <Text style={[S.serviceColLabel, { color: TEAL }]}>INCLUDED</Text>
                      </View>
                      {safeInclusions.map((item, i) => (
                        <ServiceItem key={i} text={item.replace(/^-/, "").trim()} type="included" />
                      ))}
                    </View>
                  )}
                  {safePaidServices.length > 0 && (
                    <View style={S.serviceCol}>
                      <View style={S.serviceColHeader}>
                        <View style={[S.serviceColDot, { backgroundColor: AMBER }]} />
                        <Text style={[S.serviceColLabel, { color: AMBER }]}>PAID ADD-ONS</Text>
                      </View>
                      {safePaidServices.map((item, i) => (
                        <ServiceItem key={i} text={item.replace(/^-/, "").trim()} type="paid" />
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            {/* ── NOTES ── */}
            {notes && (
              <View style={S.notesBox}>
                <Text style={[S.label, { marginBottom: 4 }]}>✦ SPECIAL NOTES</Text>
                <Text style={S.notesText}>{notes.substring(0, 250)}</Text>
              </View>
            )}

            {/* ── DISCLAIMER ── */}
            <Text style={S.sectionTitle}>Terms & Conditions</Text>
            <View style={S.disclaimerBox}>
              {safeDisclaimer.map((line, i) => (
                <Text key={i} style={S.disclaimerLine}>
                  {i + 1}. {line}
                </Text>
              ))}
            </View>

            {/* ── RECEIPT DOWNLOAD LINK ── */}
            <Link
              src={`https://goaboat.com/?ticket=${ticket}&download=receipt`}
              style={{ textDecoration: "none" }}
            >
              <View style={S.receiptStrip}>
                <View style={S.receiptStripLeft}>
                  <Text style={S.receiptStripLabel}>TAP TO DOWNLOAD</Text>
                  <Text style={S.receiptStripTitle}>Payment Receipt</Text>
                </View>
                <View style={S.receiptStripBtn}>
                  <Text style={S.receiptStripBtnText}>⬇  Get Receipt</Text>
                </View>
              </View>
            </Link>

            {/* ── FOOTER ── */}
            <View style={S.footer}>
              <Text style={S.footerText}>
                We wish you a luxurious and unforgettable sailing experience.
              </Text>
              <Text style={S.footerBrand}>
                {booking.company?.name?.toUpperCase()}
              </Text>
            </View>

          </View>
        </View>
      </Page>
    </Document>
  );
}