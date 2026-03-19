import { useRef, useEffect } from "react";

function KakaoStaticMap({ lat, lng, width = "100%", height = 120 }) {
    const ref = useRef();
    useEffect(() => {
        if (!window.kakao?.maps || !ref.current) return;
        new window.kakao.maps.StaticMap(ref.current, {
            center: new window.kakao.maps.LatLng(lat, lng),
            level: 3,
            marker: { position: new window.kakao.maps.LatLng(lat, lng) }
        });
    }, [lat, lng]);
    return <div ref={ref} style={{ width, height, borderRadius: 14, overflow: "hidden" }} />;
}

export default KakaoStaticMap;
