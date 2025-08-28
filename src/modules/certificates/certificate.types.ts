export interface Certificate {
  id: string;
  organizationId: string;
  nombre: string;
  certificateData: string;
  passwordHash: string;
  provider: string;
  serialNumber?: string;
  issuer?: string;
  subject?: string;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  isPrimary: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificateInfo {
  serialNumber: string;
  issuer: string;
  subject: string;
  validFrom: Date;
  validUntil: Date;
  subjectAlternativeNames: string[];
  keyUsage: string[];
  extendedKeyUsage: string[];
  signatureAlgorithm: string;
  publicKeyAlgorithm: string;
  thumbprint: string;
}

export interface P12ParseResult {
  certificate: string; // PEM format
  privateKey: string; // PEM format
  certificateChain: string[];
  info: CertificateInfo;
  isUANATACA: boolean;
}

export interface EncryptedCertificate {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

export interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  daysUntilExpiration: number;
}

export interface CertificateUploadRequest {
  organizationId: string;
  nombre: string;
  certificateFile: Buffer;
  password: string;
  makeItPrimary?: boolean;
}