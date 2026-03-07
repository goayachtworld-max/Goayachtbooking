import { useParams } from "react-router-dom";
import PublicHome from "./PublicHome";

export default function PublicYacht() {
  const { yachtId } = useParams();
  return <PublicHome singleYachtId={yachtId} />;
}