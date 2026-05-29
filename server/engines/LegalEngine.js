/**
 * RENTARD Legal Engine v1.0
 * Professional Juridical Architecture (Nivel Bufete)
 */

const LegalEngine = {
    /**
     * Returns a library of clauses with normative bases.
     */
    getClauses: (domain = 'LAND') => {
        const coreClauses = [
            {
                id: "DEF_001",
                title: "DEFINICIÓN DE ASSET DNA Y DECLARACIÓN DE PROPIEDAD",
                text: "Se define como Asset DNA la síntesis técnica, estética e identificadora del vehículo, la cual incluye su número de chasis (VIN/HIN/Tail Number) y placa de registro oficial, mapeados en el ledger inmutable de RENTARD. El propietario declara bajo fe de juramento la veracidad y vigencia de dicha información jurídica.",
                apa: "Constitución de la República Dominicana Art. 44 (Derecho a la Intimidad y Honor Personal) y Art. 51 (Derecho de Propiedad)",
                din: "ISO/IEC 27001 (Seguridad y Veracidad de Información)"
            },
            {
                id: "ESC_042",
                title: "GARANTÍA ESCROW E INTEGRACIÓN DE LA LEY DE SEGUROS 146-02",
                text: "La póliza de garantía en Smart Escrow opera de acuerdo a las bases del contrato de seguro P2P. Se establece que todo activo listado debe contar con una póliza de responsabilidad civil vigente de conformidad con la Ley 146-02. El fondo de escrow cubrirá daños hasta el deducible o los límites pactados en la póliza en caso de siniestro durante la vigencia del arrendamiento.",
                apa: "Ley 146-02 sobre Seguros y Fianzas de la República Dominicana (Arts. 10, 14 y 135)",
                din: "DIN 77003 (Servicios Financieros P2P)"
            },
            {
                id: "EVI_118",
                title: "MATRIZ DE EVIDENCIA DIGITAL (ANEXO VI)",
                text: "Las inspecciones pre y post entrega se realizan mediante captura fotográfica georreferenciada y sellado de tiempo criptográfico SHA-256. Ambas partes aceptan estas pruebas digitales como evidencia irrefutable en caso de disputas legales, litigios o arbitrajes.",
                apa: "Ley 126-02 de Comercio Electrónico, Documentos y Firmas Digitales y Ley 53-07 sobre Crímenes y Delitos de Alta Tecnología",
                din: "RFC 3161 (Protocolo de Sellado de Tiempo Criptográfico)"
            },
            {
                id: "PEN_156",
                title: "CÁLCULO DE ENTROPÍA POR MORA Y RETORNO TARDÍO",
                text: "El retraso en la entrega del activo generará penalidades automáticas calculadas por día o fracción de hora tardía. Estas penalidades se cargan del depósito en escrow sin perjuicio de las acciones legales por apropiación indebida o abuso de confianza.",
                apa: "Código Civil de la República Dominicana Art. 1152 (Cláusula Penal) y Ley 358-05 de Protección al Consumidor",
                din: "DIN 66399 (Estándares de Seguridad de Custodia)"
            }
        ];

        // Master Ecosystem Expansion: JURIDICAL-DENSITY:MAX
        coreClauses.push({
            id: "PRED_999",
            title: "CLÁUSULA DE PREVENCIÓN PREDICTIVA Y GESTIÓN DE RIESGO",
            text: "El sistema de reputación neural evaluará el comportamiento del conductor. Ante sospecha fundada o detección de infracciones de tránsito graves del conductor, RENTARD se reserva el derecho de inhabilitar de manera remota el encendido del activo vía IoT para preservar la seguridad vial.",
            apa: "Ley 63-17 sobre Movilidad, Transporte Terrestre, Tránsito y Seguridad Vial (Art. 222 - Infracciones y Facultades de Prevención)",
            din: "ISO 31000 (Gestión de Riesgo Operacional)"
        });

        switch (domain) {
            case 'WATER':
                coreClauses.push({
                    id: "W_001",
                    title: "ANEXO T-WATER: CHECKLIST Y CUMPLIMIENTO MARÍTIMO (ARMADA RD)",
                    text: "El arrendatario certifica poseer la Licencia de Navegación o Título de Capitán correspondiente para la categoría del buque. Se obliga a cumplir el reglamento de navegación del país, portar chalecos salvavidas para cada ocupante y obtener el Despacho de Salida emitido por la Armada de República Dominicana (ARD) antes de zarpar.",
                    apa: "Ley 300-14 de Navegación Marítima y Reglamentos Oficiales de la Armada de la República Dominicana",
                    din: "ISO 12402 (Estándar Internacional de Dispositivos de Flotación Personal)"
                });
                break;
            case 'AIR':
                coreClauses.push({
                    id: "A_001",
                    title: "ANEXO T-AIR: REGULACIÓN AERONÁUTICA CIVIL (IDAC - RAD)",
                    text: "El operador del activo aéreo declara bajo fe de juramento poseer Licencia de Piloto Aviador vigente emitida por el IDAC y Certificado Médico Aeronáutico Clase 1 o Clase 2 activo. La aeronave debe contar con Certificado de Aeronavegabilidad vigente y seguro aeronáutico especial de responsabilidad civil.",
                    apa: "Ley 491-06 de Aviación Civil de la República Dominicana e Instructivos del Reglamento de Aviación Civil (RAD 61, RAD 91)",
                    din: "Estándares FAA (Federal Aviation Administration) y OACI"
                });
                break;
            case 'LAND':
            default:
                coreClauses.push({
                    id: "L_001",
                    title: "ANEXO T-LAND: COMPROMISO DE TRÁNSITO TERRESTRE (LEY 63-17)",
                    text: "El arrendatario se compromete a conducir respetando los límites de velocidad y leyes de tránsito terrestres dominicanas. Declara poseer Licencia de Conducir física y vigente. Verifica recibir el vehículo con marbete de circulación al día, botiquín, extintor de incendios, neumático de repuesto y triángulos de emergencia.",
                    apa: "Ley 63-17 de Movilidad, Transporte Terrestre, Tránsito y Seguridad Vial de la República Dominicana (Arts. 195, 199 y 203)",
                    din: "ISO 39001 (Sistemas de Gestión de la Seguridad Vial)"
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
        let text = `========================================================================\n`;
        text += `CONTRATO MAESTRO DE ARRENDAMIENTO P2P - RENTARD RD\n`;
        text += `========================================================================\n`;
        text += `ID ÚNICO DE RESERVA: ${data.bookingId}\n`;
        text += `ARRENDATARIO (DNA RENTER): ${data.renterName}\n`;
        text += `PROPIETARIO (DNA OWNER): ${data.ownerName}\n`;
        text += `DOMINIO DE LA OPERACIÓN: ${data.domain}\n`;
        text += `FECHA DE SINTETIZACIÓN: ${new Date().toLocaleString()}\n\n`;

        clauses.forEach((c, i) => {
            text += `------------------------------------------------------------------------\n`;
            text += `CLÁUSULA ${i + 1}: ${c.title}\n`;
            text += `------------------------------------------------------------------------\n`;
            text += `${c.text}\n`;
            text += `[Base Legal: ${c.apa} | Estándar Técnico: ${c.din}]\n\n`;
        });

        text += `========================================================================\n`;
        text += `ANEXOS CONTRACTUALES & PRUEBA FÍSICA DIGITAL\n`;
        text += `========================================================================\n`;
        text += `ANEXO VI: MATRIZ DE EVIDENCIA DIGITAL REGISTRADA (SHA-256)\n`;
        data.evidences.forEach(e => {
            text += `- [${e.label}] Hash: ${e.hash} | Fecha: ${e.timestamp}\n`;
        });
        text += `\nEste documento constituye un acuerdo digital formal y vinculante bajo la legislación de la República Dominicana.`;

        return text;
    }
};

module.exports = LegalEngine;
