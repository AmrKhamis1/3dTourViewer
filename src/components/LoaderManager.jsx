import React from "react";
import "../App.css";

export default function LoaderManager({ isLoading, progress }) {
  if (!isLoading) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(20, 20, 30, 1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="loader-spinner"
        style={{
          width: 60,
          height: 60,
          border: "8px solid #eee",
          borderTop: "8px solid #3a86ff",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          marginBottom: 24,
        }}
      />
      <div
        style={{
          width: 240,
          height: 12,
          background: "#222",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: "100%",
            background: "linear-gradient(90deg, #3a86ff, #00b4d8)",
            transition: "width 0.3s",
          }}
        />
      </div>
      <div style={{ color: "#fff", fontSize: 18, fontWeight: 500 }}>
        Loading... {Math.round(progress * 100)}%
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
