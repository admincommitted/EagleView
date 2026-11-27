import { z } from 'zod';

const IATA_REGEX = /^[A-Z0-9 .-]+$/;
const IATA_MSG = 'Contains invalid characters. Only A-Z, 0-9, spaces, dots, and hyphens are allowed.';
const AWB_DIGITS = 11;

// Modulo-7 check of a MAWB number (3-digit prefix + 7-digit serial + check digit): 176-12345675 -> 1234567 % 7 == 5
const isValidModulo7 = (awb) => {
  const digits = awb.replace(/[^0-9]/g, '');
  if (digits.length !== AWB_DIGITS) return false;

  const serialNumber = parseInt(digits.substring(3, 10), 10);
  const checkDigit = parseInt(digits.substring(10, 11), 10);

  return serialNumber % 7 === checkDigit;
};

const awbSchema = z.object({
  awbNumber: z.string().min(1, 'AWB Number is required').refine(isValidModulo7, {
    message: 'Invalid MAWB Number: Failed Modulo-7 check',
  }),
  type: z.enum(['MAWB', 'HAWB', 'XFWB', 'XFHL']),
  origin: z.string().length(3, 'Origin must be exactly 3-letter IATA code').toUpperCase().regex(IATA_REGEX, IATA_MSG),
  destination: z
    .string()
    .length(3, 'Destination must be exactly 3-letter IATA code')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  totalPieces: z.number().int().min(1, 'Total Pieces must be at least 1'),
  grossWeight: z.number().min(0.1, 'Gross Weight must be greater than 0'),
  shipperName: z.string().max(35, 'ShipperName: Exceeds 35 characters limit').toUpperCase().regex(IATA_REGEX, IATA_MSG),
  consigneeName: z
    .string()
    .max(35, 'ConsigneeName: Exceeds 35 characters limit')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  shipperAddress: z
    .string()
    .min(1, 'ShipperAddress is required')
    .max(35, 'ShipperAddress cannot exceed 35 characters')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  consigneeAddress: z
    .string()
    .min(1, 'ConsigneeAddress is required')
    .max(35, 'ConsigneeAddress cannot exceed 35 characters')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  shipperCity: z
    .string()
    .min(1, 'ShipperCity is required')
    .max(17, 'ShipperCity cannot exceed 17 characters')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  consigneeCity: z
    .string()
    .min(1, 'ConsigneeCity is required')
    .max(17, 'ConsigneeCity cannot exceed 17 characters')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG),
  currencyCode: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .toUpperCase()
    .regex(IATA_REGEX, IATA_MSG)
    .optional()
    .or(z.literal('')),
  chargeCode: z.enum(['PP', 'CC', 'PC', 'CP'], { required_error: 'Charge Code (PP / CC / PC / CP) is mandatory' }),
  totalVolume: z.number().multipleOf(0.01, 'Total volume can only have up to 2 decimal places'),
  shcList: z
    .array(
      z
        .string()
        .length(3)
        .toUpperCase()
        .regex(/^[A-Z0-9]+$/),
    )
    .max(9)
    .optional(),
  dimLength: z.number().int('Length must be a whole number').optional(),
  dimWidth: z.number().int('Width must be a whole number').optional(),
  dimHeight: z.number().int('Height must be a whole number').optional(),
  flightNumber1: z.string().optional().or(z.literal('')),
  flightDate1: z.string().optional().or(z.literal('')),
  flightNumber2: z.string().optional().or(z.literal('')),
  flightDate2: z.string().optional().or(z.literal('')),
  handlingInformation: z.string().optional().or(z.literal('')),
  accountingInformation: z.string().optional().or(z.literal('')),
  declaredValueCarriage: z.string().optional().or(z.literal('')),
  declaredValueCustoms: z.string().optional().or(z.literal('')),
  amountOfInsurance: z.string().optional().or(z.literal('')),
  sci: z.string().optional().or(z.literal('')),
});

export { awbSchema };
