// tests/unit/ChildSelector.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChildSelector } from "../../src/components/multichild/EventModal/ChildSelector.jsx";

// id (family_members.id) is the FK target for events_children.child_id; user_id
// is the auth identity. The selector must emit id (the link key), not user_id.
const children = [
  { id: "c1", user_id: "u1", name: "혜니", color_hex: "#F779A8" },
  { id: "c2", user_id: "u2", name: "민준", color_hex: "#3B82F6" },
];

describe("ChildSelector", () => {
  it("자녀 N명 체크박스 + '가족 전체' 옵션 렌더", () => {
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: false }} onChange={() => {}} />);
    expect(screen.getByLabelText("혜니")).toBeInTheDocument();
    expect(screen.getByLabelText("민준")).toBeInTheDocument();
    expect(screen.getByText("가족 전체")).toBeInTheDocument();
  });

  it("자녀 체크 시 onChange 호출", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: false }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("혜니"));
    expect(onChange).toHaveBeenCalledWith({ childIds: ["c1"], familyAll: false });
  });

  it("'가족 전체' 선택 시 자녀 체크박스 모두 해제 (XOR)", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: ["c1"], familyAll: false }} onChange={onChange} />);
    fireEvent.click(screen.getByText("가족 전체"));
    expect(onChange).toHaveBeenCalledWith({ childIds: [], familyAll: true });
  });

  it("자녀 체크 시 '가족 전체' 자동 해제 (XOR)", () => {
    const onChange = vi.fn();
    render(<ChildSelector children={children} value={{ childIds: [], familyAll: true }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("혜니"));
    expect(onChange).toHaveBeenCalledWith({ childIds: ["c1"], familyAll: false });
  });

  it("1자녀 모드에서는 컴포넌트 자동 hide", () => {
    const { container } = render(
      <ChildSelector children={[children[0]]} value={{ childIds: ["c1"], familyAll: false }} onChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });
});
