// tests/unit/SendStickerSheet.test.jsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SendStickerSheet } from "../../src/components/childMode/SendStickerSheet.jsx";

describe("SendStickerSheet", () => {
    it("닫혀 있을 때는 미렌더", () => {
        const { container } = render(<SendStickerSheet open={false} stickers={["❤️", "🐰"]} />);
        expect(container.querySelector('.sticker-grid')).toBeNull();
    });

    it("열려 있을 때 sticker 그리드 + 안내 문구 표시", () => {
        render(<SendStickerSheet open stickers={["❤️", "🐰", "🎉", "👍"]} />);
        expect(screen.getByText(/보낼 스티커를 골라줘/)).toBeInTheDocument();
        expect(screen.getByLabelText("❤️ 스티커 선택")).toBeInTheDocument();
        expect(screen.getByLabelText("🐰 스티커 선택")).toBeInTheDocument();
    });

    it("선택 전에는 보내기 disabled", () => {
        render(<SendStickerSheet open stickers={["❤️"]} />);
        expect(screen.getByText("보내기")).toBeDisabled();
    });

    it("스티커 선택 시 data-selected=true 적용", () => {
        render(<SendStickerSheet open stickers={["❤️", "🐰"]} />);
        const cell = screen.getByLabelText("❤️ 스티커 선택");
        fireEvent.click(cell);
        expect(cell).toHaveAttribute("data-selected", "true");
    });

    it("선택 후 보내기 클릭 시 onSend(emoji) 호출", () => {
        const onSend = vi.fn();
        render(<SendStickerSheet open stickers={["🎉"]} onSend={onSend} />);
        fireEvent.click(screen.getByLabelText("🎉 스티커 선택"));
        fireEvent.click(screen.getByText("보내기"));
        expect(onSend).toHaveBeenCalledWith("🎉");
    });

    it("isSending=true 시 라벨이 보내는 중…", () => {
        render(<SendStickerSheet open stickers={["⭐"]} isSending />);
        expect(screen.getByText("보내는 중…")).toBeInTheDocument();
    });
});
