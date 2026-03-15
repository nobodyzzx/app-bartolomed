import { DataSource } from 'typeorm';

// Seed removido - usar godmode para crear usuario inicial
export async function seed(_dataSource: DataSource) {
  console.log('ℹ️ User seed disabled - use godmode endpoint to create initial super admin');
}
