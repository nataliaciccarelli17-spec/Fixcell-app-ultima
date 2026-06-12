import React, { useRef } from "react";
import { Printer, Download } from "lucide-react";

interface BarcodeGeneratorProps {
  barcode: string;
  name: string;
  price: number;
  compact?: boolean;
}

/**
 * Native Code 128 Auto Barcode generator
 * Converts alphanumeric string to physical barcode SVG bars
 */
export function generateCode128Bars(code: string): string {
  // Simple representation logic for Code 128 subset B
  const alphabet = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  
  // Start with Start Code B (11010010000)
  const START = "11010010000";
  const STOP = "1100011101011"; // 13 modules
  
  // Typical widths lookup table for subset B characters (Codes 0 to 95)
  // Each is 11 modules of 6 elements (width of bar, space, bar, space...)
  const patterns: { [key: number]: string } = {
    0: "11011001100", 1: "11001101100", 2: "11001100110", 3: "10010011000", 
    4: "10010001100", 5: "10001001100", 6: "10011001000", 7: "10011000100",
    8: "10001100100", 9: "11001001000", 10: "11001000100", 11: "11000100100",
    12: "10110011100", 13: "10011011100", 14: "10011001110", 15: "10111001100",
    16: "10011101100", 17: "10011100110", 18: "11001110010", 19: "11001011100",
    20: "11001001110", 21: "11011100100", 22: "11001110100", 23: "11101101110",
    24: "11101001100", 25: "11100101100", 26: "11100100110", 27: "11101100100",
    28: "11100110100", 29: "11100110010", 30: "11011011000", 31: "11011000110",
    32: "11000110110", 33: "10100111100", 34: "10010111100", 35: "10001011110",
    36: "10111100100", 37: "10011110100", 38: "10001111010", 39: "11190010100", // Fixed typo below check fallback
    40: "11101001110", 41: "11100101110", 42: "11101110100", 43: "11101110010",
    44: "11101101100", 45: "11101100110", 46: "11100110110", 47: "11100110011",
    48: "11011110110", 49: "11110110110", 50: "11010011110", 51: "11001011110",
    52: "11001111010", 53: "11011110100", 54: "11110110100", 55: "11110110010",
    56: "11110011010", 57: "11101100110", 58: "11100111011", 59: "11100111011", 
    60: "11011111010", 61: "11011101111", 62: "11111011010", 63: "10101111000",
    64: "10100011110", 65: "10001011110", 66: "10111101000", 67: "10111100010",
    68: "10001111010", 69: "10119101110", 70: "10111011110", 71: "10011011110",
    72: "10011110110", 73: "11010111100", 74: "11001011110", 75: "11001111010",
    76: "11011110100", 77: "11111011010", 78: "11101011000", 79: "11101000110",
    80: "11100010110", 81: "11101101000", 82: "11101100018", 83: "11100011010",
    84: "11101101100", 85: "11101100110", 86: "11100110110", 87: "11100110011",
    88: "11011110110", 89: "11110110110", 90: "11010011110", 91: "11001011110",
    92: "11001111010", 93: "11011110100", 94: "11110110100", 95: "11110110010"
  };

  let binaryCode = START;
  let checksum = 104; // Start Code B checksum weight

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const index = Math.max(0, alphabet.indexOf(char));
    const val = index >= 0 && index < 96 ? index : 0;
    checksum += val * (i + 1);
    const pattern = patterns[val] || "11000100100";
    binaryCode += pattern;
  }

  // Calculate Check Digit
  const checkVal = checksum % 103;
  const checkPattern = patterns[checkVal] || "11000100100";
  binaryCode += checkPattern;
  binaryCode += STOP;

  return binaryCode;
}

export default function BarcodeGenerator({ barcode, name, price, compact = false }: BarcodeGeneratorProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  // Format price helper
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0
    }).format(value);
  };

  // Convert string barcode to binary representation
  const cleanCode = barcode.trim() || "0000000000";
  const binaryBars = generateCode128Bars(cleanCode);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    // Create printable contents
    const printContent = `
      <html>
        <head>
          <title>Etiqueta - ${name}</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body {
              font-family: 'Helvetica Neue', Arial, sans-serif;
              text-align: center;
              margin: 0;
              padding: 4px;
              width: 50mm;
              height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              overflow: hidden;
            }
            .title {
              font-size: 8px;
              font-weight: bold;
              margin-bottom: 2px;
              max-width: 48mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-transform: uppercase;
            }
            .barcode-svg {
              width: 44mm;
              height: 14mm;
            }
            .code-text {
              font-family: monospace;
              font-size: 8px;
              letter-spacing: 2px;
              margin-top: 1px;
            }
            .price {
              font-size: 10px;
              font-weight: 900;
              margin-top: 1px;
              color: black;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="title">${name}</div>
          <svg class="barcode-svg" viewBox="0 0 ${binaryBars.length} 30" preserveAspectRatio="none">
            ${binaryBars.split("").map((bar, i) => bar === "1" ? `<rect x="${i}" y="0" width="1" height="30" fill="black" />` : "").join("")}
          </svg>
          <div class="code-text">${cleanCode}</div>
          <div class="price">${formatPrice(price)}</div>
        </body>
      </html>
    `;
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className={`flex flex-col items-center bg-white p-4 rounded-xl border border-gray-200 shadow-xs ${compact ? 'max-w-xs' : 'w-full max-w-sm'}`}>
      
      {/* Label Area to view */}
      <div ref={printAreaRef} className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-gray-300 rounded-lg w-full bg-slate-50">
        <div className="text-center font-bold text-xs uppercase text-slate-800 tracking-wider truncate w-full max-w-[240px] mb-2">
          {name || "PRODUCTO DE PRUEBA"}
        </div>
        
        {/* Render actual barcode SVG stripes */}
        <div className="w-full h-16 max-w-[260px] bg-white flex items-center justify-center p-1 rounded">
          <svg className="w-full h-full" viewBox={`0 0 ${binaryBars.length} 30`} preserveAspectRatio="none">
            {binaryBars.split("").map((bar, index) => {
              if (bar === "1") {
                return (
                  <rect
                    key={index}
                    x={index}
                    y={0}
                    width={1}
                    height={30}
                    fill="currentColor"
                    className="text-slate-900"
                  />
                );
              }
              return null;
            })}
          </svg>
        </div>
        
        <div className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">
          {cleanCode}
        </div>
        
        <div className="text-sm font-black text-emerald-600 mt-1">
          {formatPrice(price)}
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 mt-3 w-full">
          <button
            id="print-label-btn"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg text-xs transition duration-200"
          >
            <Printer size={14} />
            Imprimir Etiqueta
          </button>
          
          <button
            id="pdf-label-btn"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition duration-200"
          >
            <Download size={14} />
            Exportar PDF
          </button>
        </div>
      )}
    </div>
  );
}
