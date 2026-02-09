import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#F4F6F8",
    fontFamily: "Helvetica",
    fontSize: 11,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 20,
    border: "1 solid #E0E0E0",
  },
  header: {
    borderBottom: "1 solid #000",
    paddingBottom: 10,
    marginBottom: 14,
  },
  ticket: {
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  status: {
    marginTop: 4,
    fontSize: 10,
    color: "#444",
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#666",
    fontSize: 10,
  },
  value: {
    fontSize: 11,
    fontWeight: "bold",
  },
  divider: {
    borderBottom: "1 solid #E0E0E0",
    marginVertical: 10,
  },
  highlight: {
    fontSize: 12,
    fontWeight: "bold",
  },
  inclusionItem: {
    marginBottom: 3,
    fontSize: 10,
    lineHeight: 1.4,
  },
});

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

  /* ---------- EXTRA DETAILS PARSING (🔥 SAME AS COPY) ---------- */

  const extraDetails = sanitizeText(booking.extraDetails || "");

  const inclusions = extraDetails
    ? extraDetails
        .split("\n")
        .filter((i) =>
          ["Soft Drink", "Ice Cube", "Water Bottles", "Bluetooth Speaker", "Captain", "Snacks"]
            .some((k) => i.includes(k))
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

  /* ---------- DISCLAIMER ---------- */

  const companyDisclaimer = sanitizeText(booking?.company?.disclaimer || "");

  const hardCodedDisclaimer = sanitizeText(`
Reporting time is 30 minutes prior to departure
No refund for late arrival or no-show
Subject to weather and government regulations
Thank you for booking with ${booking.company?.name}
  `);

  let disclaimerLines = (
    companyDisclaimer || hardCodedDisclaimer
  )
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (companyDisclaimer) {
    disclaimerLines = disclaimerLines.map(line =>
      line.toLowerCase().includes("ticket id")
        ? `${line} [${ticket}]`
        : line
    );
  }

  /* ===================== RENDER ===================== */

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.card}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.ticket}>BOARDING PASS — {ticket}</Text>
            <Text style={styles.status}>
              Booking Status: {booking.status?.toUpperCase()}
            </Text>
          </View>

          {/* GUEST */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Guest Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Guest</Text>
              <Text style={styles.value}>{booking.customerId?.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Contact</Text>
              <Text style={styles.value}>{booking.customerId?.contact}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Guests</Text>
              <Text style={styles.value}>{booking.numPeople} Pax</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* TRIP */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Yacht</Text>
              <Text style={styles.value}>{booking.yachtId?.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(booking.date)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.value}>
                {booking.startTime} – {booking.endTime}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* PAYMENT */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <Text style={styles.highlight}>
              Balance Pending: ₹{booking.pendingAmount}/-
            </Text>
          </View>

          {/* INCLUSIONS */}
          {inclusions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inclusions</Text>
              {inclusions.map((i, idx) => (
                <Text key={idx} style={styles.inclusionItem}>
                  - {i.replace("-", "").trim()}
                </Text>
              ))}
            </View>
          )}

          {/* EXTRA PAID SERVICES */}
          {paidServices.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Extra Paid Services</Text>
              {paidServices.map((i, idx) => (
                <Text key={idx} style={styles.inclusionItem}>
                  - {i.replace("-", "").trim()}
                </Text>
              ))}
            </View>
          )}

          {/* NOTES */}
          {notes && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.inclusionItem}>{notes}</Text>
            </View>
          )}

          {/* DISCLAIMER */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disclaimer</Text>
            {disclaimerLines.map((line, i) => (
              <Text key={i} style={styles.inclusionItem}>
                - {line}
              </Text>
            ))}
          </View>

        </View>
      </Page>
    </Document>
  );
}
