// /api/* on the website (dashboard + rent-a-car pages) is answered by the Hostio server.
import { forward } from "../../cloudflare/server.js";

export const onRequest = ({ request }) => forward(request, new URL(request.url).pathname);
