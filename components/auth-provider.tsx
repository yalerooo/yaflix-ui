"use client";

import { ReactNode, useEffect, useState } from "react";
import { uuidv4 } from "@/lib/utils";
import { Api } from "@/api";
import { PLEX } from "@/constants";
import { ServerProvider } from "@/components/server-provider";

function redirectPlexAuth({
  pin,
  pinID,
  uuid,
}: {
  pin: string;
  pinID: number;
  uuid: string;
}) {
  window.location.href = `https://app.plex.tv/auth/#!?clientID=${
    uuid
  }&context[device][product]=${
    PLEX.application
  }&context[device][version]=4.118.0&context[device][platform]=Firefox&context[device][platformVersion]=122.0&context[device][device]=Linux&context[device][model]=bundled&context[device][screenResolution]=1920x945,1920x1080&context[device][layout]=desktop&context[device][protocol]=${window.location.protocol.replace(
    ":",
    "",
  )}&forwardUrl=${window.location.protocol}//${
    window.location.host
  }/login?pinID=${pinID}&code=${pin}&language=en`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let pin = localStorage.getItem("pin");
    const stored = localStorage.getItem("token");
    const pinId = new URL(location.href).searchParams.get("pinID");
    let uuid = localStorage.getItem("uuid");

    if (!uuid) {
      uuid = uuidv4();
      localStorage.setItem("uuid", uuid);
    }

    // if token is not set in the local storage
    if (!stored) {
      // if the pinID is not set redirect to plex auth for login
      if (!pinId) {
        Api.pin({ uuid })
          .then((res) => {
            pin = res.data.code;
            localStorage.setItem("pin", pin);
            redirectPlexAuth({ pin: pin, pinID: res.data.id, uuid });
          })
          .catch((err) => {
            console.error(err);
            // TODO: handle error
          });
        // else (when the pinID is set, fetch a new auth token
      } else {
        Api.token({ uuid, pin: pinId })
          .then(async (res) => {
            // should have the token here
            if (!res.data.authToken) {
              // TODO: handle error
              return;
            }

            // update/set the plex token then redirect to home screen
            localStorage.setItem("token", res.data.authToken);
            localStorage.setItem("auth-token", res.data.authToken);
            window.location.href = "/";
            setSigned(true);
          })
          .catch((err) => {
            console.error(err);
            // TODO: handle error
          });
      }
    } else {
      setSigned(true);
    }
  }, [mounted]);

  if (!mounted || !signed) return null;

  return <ServerProvider>{children}</ServerProvider>;
}
