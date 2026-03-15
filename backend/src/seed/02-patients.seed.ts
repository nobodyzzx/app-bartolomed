import { DataSource } from 'typeorm';

// Seed removido - usar API para crear pacientes reales
export async function seed(_dataSource: DataSource) {
  console.log('ℹ️ Patient seed disabled - use API to create real patient data');
}
