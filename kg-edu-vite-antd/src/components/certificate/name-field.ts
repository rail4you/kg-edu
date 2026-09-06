export interface NameFieldConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  letterSpacing: number;
  textAlign: "left" | "center" | "right";
}

export const DEFAULT_NAME_FIELD: NameFieldConfig = {
  x: 0.2,
  y: 0.45,
  width: 0.6,
  height: 0.08,
  fontFamily: "serif",
  fontSize: 36,
  fontWeight: "normal",
  color: "#000000",
  letterSpacing: 4,
  textAlign: "center",
};

export const DEFAULT_CERT_NO_FIELD: NameFieldConfig = {
  x: 0.2,
  y: 0.55,
  width: 0.6,
  height: 0.06,
  fontFamily: "serif",
  fontSize: 24,
  fontWeight: "normal",
  color: "#000000",
  letterSpacing: 2,
  textAlign: "center",
};
