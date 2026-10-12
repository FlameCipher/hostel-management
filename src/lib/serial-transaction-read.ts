/**
 * Prisma adapter-pg interactive transactions share one PostgreSQL client.
 * Parallel queries on that client trigger pg's deprecated concurrent behavior.
 */
export async function readTransferCandidates<T,U>(
  occupancyQuery:()=>Promise<T>,targetQuery:()=>Promise<U>,
):Promise<readonly [T,U]> {
  const occupancy=await occupancyQuery();
  const target=await targetQuery();
  return [occupancy,target] as const;
}
