export type ProductAllocationMode = 'exclusive' | 'metered' | 'ratio';
export type ProductStatus = 'active' | 'inactive';

export interface ProductEnergyAllocation {
  energyUnitId: string;
  share: number;
}

export interface ProductMaster {
  productId: string;
  productName: string;
  productCategory: string;
  unit: string;
  linkedEnergyUnitIds: string[];
  allocationMode: ProductAllocationMode;
  energyAllocations: ProductEnergyAllocation[];
  directEnergyRecordIds: string[];
  status: ProductStatus;
}

export type ProductWriteInput = Omit<ProductMaster, 'productId'>;
