/**
 * RENTARD Legal Engine v1.0
 * Professional Juridical Architecture (Nivel Bufete)
 */

const LegalEngine = {
    /**
     * Returns a library of clauses with normative bases.
     */
    getClauses: (domain = 'LAND') => {
        // For simulation, we provide the core high-density structure.
        // In a production environment, this would hold 178 detailed clauses.
        const coreClauses = [
            {
                id: "DEF_001",
                title: "DEFINICIÓN DE ASSET DNA",
                text: "Se define como Asset DNA la síntesis técnica y estética del vehículo...",
                apa: "Constitución RD 2010 Art. 44 (Privacidad)",
                din: "ISO/IEC 27001 (Data Integrity)"
            },
            {
                id: "ESC_042",
                title: "SINCRO DE ESCROW JURÍDICO",
                text: "La garantía queda retenida en un estado de 'Opaque Governance' hasta...",
                apa: "Ley 126-02 (Comercio Electrónico)",
                din: "DIN 77003 (Financial Services)"
            },
            {
                id: "EVI_118",
                title: "MATRIZ DE EVIDENCIA (ANEXO VI)",
                text: "Cada foto capturada genera un hash SHA-256 inmutable vinculado al contrato...",
                apa: "Ley 53-07 (Crímenes de Alta Tecnología)",
                din: "RFC 3161 (Time-Stamping Protocol)"
            },
            {
                id: "PEN_156",
                title: "CÁLCULO DE ENTROPÍA POR MORA",
                text: "Las penalidades se calculan algorítmicamente basadas en el retraso...",
                apa: "Ley 358-05 (Protección al Consumidor)",
                din: "DIN 66399 (Security Levels)"
            }
        ];

        // --- Master Ecosystem Expansion: JURIDICAL-DENSITY:MAX ---
        coreClauses.push({
            id: "PRED_999",
            title: "CLÁUSULA DE PREVENCIÓN PREDICTIVA (ECOSISTEMA MAESTRO)",
            text: "En base a la simulación a 10 pasos, el sistema activa automáticamente un escudo de contingencia legal ante desviaciones de entropía superiores al 0.05%...",
            apa: "Normativa Pro-Consumidor 2024",
            din: "ISO 31000 (Risk Management)"
        });

        switch (domain) {
            case 'WATER':
                coreClauses.push({
                    id: "W_001",
                    title: "ANEXO T-WATER: CHECKLIST DE SEGURIDAD MARÍTIMA",
                    text: "El arrendatario confirma recibir chalecos salvavidas, equipo de flotación, y certifica conocer el estado de las mareas y regulaciones de Capitanía de Puerto.",
                    apa: "Ley 300-14 de Navegación",
                    din: "ISO 12402 (Lifejackets)"
                });
                break;
            case 'AIR':
                coreClauses.push({
                    id: "A_001",
                    title: "ANEXO T-AIR: CHECKLIST DE REGULACIÓN AERONÁUTICA",
                    text: "El operador certifica poseer licencia de vuelo vigente, horas de vuelo comprobables y aprueba la revisión prevuelo (Altimetría, Meteorología).",
                    apa: "IDAC RD Normativa",
                    din: "FAA Standard"
                });
                break;
            case 'LAND':
            default:
                coreClauses.push({
                    id: "L_001",
                    title: "ANEXO T-LAND: CHECKLIST DE TRÁNSITO TERRESTRE",
                    text: "Cobertura bajo la ley 63-17. El arrendatario verifica el estado de frenos, neumáticos, luces y posee licencia de conducir terrestre vigente.",
                    apa: "Ley 63-17 de Tránsito",
                    din: "ISO 39001 (Road Traffic Safety)"
                });
                break;
        }

        return coreClauses;
    },

    /**
     * Forges the full juridical text for a contract.
     */
    forgeJuridicalText: (data) => {
        const clauses = LegalEngine.getClauses(data.domain);
        let text = `CONTRATO MAESTRO DE RENTA P2P - RENTARD SUPREMA x1000\n`;
        text += `ID DE RESERVA: ${data.bookingId}\n`;
        text += `VVIP RENTER: ${data.renterName}\n`;
        text += `VVIP OWNER: ${data.ownerName}\n`;
        text += `FECHA: ${new Date().toLocaleString()}\n\n`;

        clauses.forEach((c, i) => {
            text += `CLÁUSULA ${i + 1}: ${c.title}\n`;
            text += `${c.text}\n`;
            text += `[Base APA: ${c.apa} | Base DIN: ${c.din}]\n\n`;
        });

        text += `\n--- ANEXOS ---\n`;
        text += `ANEXO VI: MATRIZ DE EVIDENCIA DIGITAL (SHA-256)\n`;
        data.evidences.forEach(e => {
            text += `- ${e.label}: ${e.hash} (${e.timestamp})\n`;
        });

        return text;
    }
};

module.exports = LegalEngine;
