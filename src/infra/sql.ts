export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}

export interface SqlPool extends SqlClient {
  connect(): Promise<SqlConnection>;
}

export interface SqlConnection extends SqlClient {
  release(): void;
}
