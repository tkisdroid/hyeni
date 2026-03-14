import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      const stack = this.state.error?.stack || "";
      const componentStack = this.state.errorInfo?.componentStack || "";
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FFF0F7", padding: 24, fontFamily: "'Noto Sans KR', sans-serif" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐰</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#E879A0", marginBottom: 8 }}>앗, 문제가 생겼어요!</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12, textAlign: "center", wordBreak: "break-all", maxWidth: 360 }}>
            {this.state.error?.message || "알 수 없는 오류"}
          </div>
          <details style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 20, maxWidth: 360, maxHeight: 200, overflow: "auto", background: "#F9FAFB", padding: 10, borderRadius: 8, width: "100%" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>상세 오류 정보</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginTop: 8 }}>{stack}{componentStack}</pre>
          </details>
          <button onClick={() => { try { localStorage.clear(); } catch {} window.location.reload(); }}
            style={{ padding: "12px 24px", background: "#E879A0", color: "white", border: "none", borderRadius: 16, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            초기화 후 다시 시작
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
