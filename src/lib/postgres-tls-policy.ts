/**
 * pg-connection-string versions before v3 interpret sslmode=require/verify-ca/prefer
 * as verify-full and emit a warning. Explicit verification prevents a
 * silent TLS downgrade when dependencies are upgraded.
 * Never log or expose connection credentials.
 */
export function enforcePostgresVerifyFull(connectionString:string) {
  return connectionString.replace(
    /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/gi,
    (_whole,prefix:string,_mode:string,suffix:string)=>prefix+"verify-full"+suffix,
  );
}
