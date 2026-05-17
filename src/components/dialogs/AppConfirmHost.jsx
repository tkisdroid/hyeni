// src/components/dialogs/AppConfirmHost.jsx
// 전역 appConfirm() 요청을 받아 디자인된 AppConfirmDialog 를 렌더하는 단일 host.
// App.jsx 에 한 번만 마운트한다.

import { useEffect, useState } from "react";
import { AppConfirmDialog } from "./AppConfirmDialog.jsx";
import { setAppConfirmHandler } from "../../lib/appConfirm.js";

export function AppConfirmHost() {
    const [request, setRequest] = useState(null);

    useEffect(() => setAppConfirmHandler((req) => setRequest(req)), []);

    if (!request) return null;

    const settle = (result) => {
        setRequest(null);
        request.resolve(result);
    };

    return (
        <AppConfirmDialog
            dialog={request}
            onCancel={() => settle(false)}
            onConfirm={() => settle(true)}
        />
    );
}
