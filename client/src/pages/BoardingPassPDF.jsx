import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

/* ===================== HELPERS ===================== */

const sanitizeText = (text = "") =>
  text
    .replace(/\u2022|\u2023|\u25E6/g, "-")
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

/* ===================== COMPONENT ===================== */

export default function BoardingPassPDF({ booking }) {
  if (!booking) return null;

  const ticket = booking._id.slice(-5).toUpperCase();

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  /* ===================== PARSE EXTRA DETAILS ===================== */

  const extraDetails = sanitizeText(booking.extraDetails || "");

  const inclusions = extraDetails
    ? extraDetails
      .split("\n")
      .filter((i) =>
        [
          "Soft Drink",
          "Ice Cube",
          "Water Bottles",
          "Bluetooth Speaker",
          "Captain",
          "Snacks",
        ].some((k) => i.includes(k))
      )
    : [];

  const paidServices = extraDetails
    ? extraDetails
      .split("\n")
      .filter((i) =>
        ["Drone", "DSLR"].some((k) => i.includes(k))
      )
    : [];

  const notes = extraDetails.includes("Notes:")
    ? extraDetails.split("Notes:").slice(1).join("Notes:").trim()
    : "";

  const disclaimerText = sanitizeText(
    booking?.company?.disclaimer ||
    `
Reporting time is 30 minutes prior to departure
No refund for late arrival or no-show
Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}
`
  );

  const disclaimerLines = disclaimerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  /* ===================== SMART CONTENT ANALYSIS ===================== */

  const totalLines =
    inclusions.length +
    paidServices.length +
    disclaimerLines.length +
    (notes ? 2 : 0);

  let fontScale = 1;
  let sectionSpacing = 16;
  let maxLines = 8;

  if (totalLines > 12) {
    fontScale = 0.95;
    sectionSpacing = 12;
    maxLines = 6;
  }

  if (totalLines > 18) {
    fontScale = 0.88;
    sectionSpacing = 8;
    maxLines = 5;
  }

  const safeInclusions = inclusions.slice(0, maxLines);
  const safePaidServices = paidServices.slice(0, maxLines);
  const safeDisclaimer = disclaimerLines.slice(0, maxLines);

  /* ===================== DYNAMIC STYLES ===================== */

  const styles = StyleSheet.create({
    page: {
      padding: 12,
      backgroundColor: "#EEF1F4",
      fontFamily: "Helvetica",
      fontSize: 12 * fontScale,
    },

    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      overflow: "hidden",
      border: "1 solid #E5E7EB",
    },

    header: {
      backgroundColor: "#0F172A",
      padding: 10,
    },

    companyName: {
      color: "#FFFFFF",
      fontSize: 15 * fontScale,
      letterSpacing: 1,
    },

    boardingTitle: {
      color: "#FFFFFF",
      fontSize: 18 * fontScale,
      fontWeight: "bold",
      marginTop: 4,
    },

    ticket: {
      color: "#CBD5E1",
      fontSize: 13 * fontScale,
      marginTop: 3,
    },

    content: {
      padding: 10,
    },

    section: {
      marginBottom: sectionSpacing,
    },

    sectionTitle: {
      fontSize: 10 * fontScale,
      fontWeight: "bold",
      color: "#64748B",
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },

    column: {
      width: "48%",
    },

    dualColumnRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: sectionSpacing,
    },

    halfSection: {
      width: "48%",
    },

    label: {
      fontSize: 10 * fontScale,
      color: "#64748B",
    },

    value: {
      fontSize: 12 * fontScale,
      fontWeight: "bold",
      marginTop: 2,
    },

    divider: {
      borderBottom: "1 solid #E2E8F0",
      marginVertical: 4,
    },

    paymentBox: {
      backgroundColor: "#F8FAFC",
      padding: 6,
      borderRadius: 8,
      border: "1 solid #E2E8F0",
    },

    paymentAmount: {
      fontSize: 14 * fontScale,
      fontWeight: "bold",
      marginTop: 3,
    },

    listItem: {
      fontSize: 10 * fontScale,
      marginBottom: 2,
      lineHeight: 1.1,
    },

    disclaimerBox: {
      backgroundColor: "#F1F5F9",
      padding: 5,
      borderRadius: 8,
      border: "1 solid #E2E8F0",
    },

    footer: {
      marginTop: 7,
      fontSize: 8 * fontScale,
      color: "#64748B",
      textAlign: "center",
    },
  });

  /* ===================== RENDER ===================== */

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap={false}>
        <View style={styles.card} wrap={false}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.companyName}>
              {booking.company?.name?.toUpperCase()}
            </Text>
            {/* <Text style={styles.boardingTitle}>
              LUXURY YACHT BOARDING PASS
            </Text> */}
            <Text style={styles.ticket}>
              Ticket ID: {ticket} | Status: {booking.status?.toUpperCase()}
            </Text>
          </View>

          <View style={styles.content} wrap={false}>

            {/* JOURNEY */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Guest & Journey</Text>

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Guest</Text>
                  <Text style={styles.value}>
                    {booking.customerId?.name}
                  </Text>
                </View>

                <View style={styles.column}>
                  <Text style={styles.label}>Contact</Text>
                  <Text style={styles.value}>
                    {booking.customerId?.contact}
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Yacht</Text>
                  <Text style={styles.value}>
                    {booking.yachtId?.name}
                  </Text>
                </View>

                <View style={styles.column}>
                  <Text style={styles.label}>Guests</Text>
                  <Text style={styles.value}>
                    {booking.numPeople} Pax
                  </Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.column}>
                  <Text style={styles.label}>Date</Text>
                  <Text style={styles.value}>
                    {formatDate(booking.date)}
                  </Text>
                </View>

                <View style={styles.column}>
                  <Text style={styles.label}>Time</Text>
                  <Text style={styles.value}>
                    {booking.startTime} – {booking.endTime}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* PAYMENT */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Summary</Text>
              <View style={styles.paymentBox}>
                <Text style={styles.label}>Balance Pending</Text>
                <Text style={styles.paymentAmount}>
                  Rs. {booking.pendingAmount}/-
                </Text>
              </View>
            </View>

            {/* INCLUSIONS + EXTRA SERVICES SIDE BY SIDE */}
            {(safeInclusions.length > 0 || safePaidServices.length > 0) && (
              <View style={styles.dualColumnRow}>

                {/* LEFT COLUMN - INCLUSIONS */}
                <View style={styles.halfSection}>
                  {safeInclusions.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>
                        Extra Included Services:
                      </Text>
                      {safeInclusions.map((i, idx) => (
                        <Text key={idx} style={styles.listItem}>
                          • {i.replace("-", "").trim()}
                        </Text>
                      ))}
                    </>
                  )}
                </View>

                {/* RIGHT COLUMN - PAID SERVICES */}
                <View style={styles.halfSection}>
                  {safePaidServices.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>
                        Extra Paid Services:
                      </Text>
                      {safePaidServices.map((i, idx) => (
                        <Text key={idx} style={styles.listItem}>
                          • {i.replace("-", "").trim()}
                        </Text>
                      ))}
                    </>
                  )}
                </View>
              </View>
            )}


            {/* NOTES */}
            {notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Special Notes:</Text>
                <Text style={styles.listItem}>
                  {notes.substring(0, 200)}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* DISCLAIMER */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Disclaimer: </Text>
              <View style={styles.disclaimerBox}>
                {safeDisclaimer.map((line, i) => (
                  <Text key={i} style={styles.listItem}>
                    • {line}
                  </Text>
                ))}
              </View>
            </View>

            <Text style={styles.footer}>
              We wish you a luxurious and unforgettable sailing experience.
            </Text>

          </View>
        </View>
      </Page>
    </Document>
  );
}
