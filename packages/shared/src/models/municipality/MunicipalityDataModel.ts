export interface MunicipalityData {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
  createdAt: Date
}

export interface MunicipalityDataInput {
  name: string
  province: string
  comunidadAutonoma: string
  codigoINE: string
}

export function buildMunicipalityData(input: MunicipalityDataInput): MunicipalityData {
  return { ...input, createdAt: new Date() }
}

export interface BarrioData {
  name: string
  municipalityId: string
  createdAt: Date
}

export interface BarrioDataInput {
  name: string
  municipalityId: string
}

export function buildBarrioData(input: BarrioDataInput): BarrioData {
  return { ...input, createdAt: new Date() }
}

export interface CemeteryData {
  name: string
  description: string | null
  municipalityId: string
  createdAt: Date
}

export interface CemeteryDataInput {
  name: string
  municipalityId: string
  description?: string | null
}

export function buildCemeteryData(input: CemeteryDataInput): CemeteryData {
  return {
    name: input.name,
    municipalityId: input.municipalityId,
    description: input.description ?? null,
    createdAt: new Date(),
  }
}
