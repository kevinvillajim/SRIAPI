export interface SignatureOptions {
  algorithm?: 'SHA1' | 'SHA256';
  signatureType?: 'ENVELOPED' | 'ENVELOPING' | 'DETACHED';
  canonicalizationMethod?: string;
  includeKeyValue?: boolean;
  includeSigningTime?: boolean;
  policyIdentifier?: string;
}

export interface XAdESSignedInfo {
  canonicalizationMethod: string;
  signatureMethod: string;
  references: Reference[];
}

export interface Reference {
  id: string;
  uri: string;
  type?: string;
  transforms: Transform[];
  digestMethod: string;
  digestValue: string;
}

export interface Transform {
  algorithm: string;
  xpath?: string;
}

export interface SigningCertificate {
  certDigest: {
    digestMethod: string;
    digestValue: string;
  };
  issuerSerial: {
    issuerName: string;
    serialNumber: string;
  };
}

export interface SignatureValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  signatureInfo?: {
    signingTime?: Date;
    signerCertificate?: string;
    signatureAlgorithm?: string;
  };
}

export interface XAdESSignatureData {
  signatureId: string;
  signatureValue: string;
  signingTime: Date;
  certificate: string;
  keyInfo: {
    x509Certificate: string;
    x509IssuerName: string;
    x509SerialNumber: string;
  };
}