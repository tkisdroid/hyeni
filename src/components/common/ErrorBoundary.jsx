import { Component } from "react";
import { addErrorLog } from "../../lib/errorLogger.js";
import { FF } from "../../lib/utils.js";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    addErrorLog({
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleFeedback = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRequestFeedback) {
      this.props.onRequestFeedback();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100vh", padding: 32,
          fontFamily: FF, textAlign: "center", background: "#FAFAFA",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😢</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1F2937", margin: "0 0 8px" }}>
            앗, 문제가 생겼어요!
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px", lineHeight: 1.5 }}>
            예상치 못한 오류가 발생했어요.<br />
            다시 시도하거나 피드백을 보내주세요.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={this.handleRetry} style={{
              padding: "12px 24px", borderRadius: 12, border: "2px solid #E5E7EB",
              background: "white", fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: FF,
            }}>
              🔄 다시 시도
            </button>
            <button onClick={this.handleFeedback} style={{
              padding: "12px 24px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
              color: "white", fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: FF,
            }}>
              💬 피드백 보내기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
