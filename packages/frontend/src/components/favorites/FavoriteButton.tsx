import { createSignal } from "solid-js";
import { toggleFavorite } from "../../lib/api/user-activity";

interface FavoriteButtonProps {
  targetType: "project" | "document" | "workflow";
  targetId: string;
  initialFavorited?: boolean;
  class?: string;
}

const STAR_PATH =
  "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

export default function FavoriteButton(props: FavoriteButtonProps) {
  const [favorited, setFavorited] = createSignal(props.initialFavorited ?? false);
  const [loading, setLoading] = createSignal(false);

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (loading()) return;

    setLoading(true);
    try {
      const result = await toggleFavorite(props.targetType, props.targetId);
      setFavorited(result.favorited);
    } catch {
      // Silently fail — don't disrupt UX for a non-critical action
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading()}
      class={`cursor-pointer transition-colors duration-150 disabled:opacity-50 ${props.class ?? ""}`}
      title={favorited() ? "取消收藏" : "收藏"}
      aria-label={favorited() ? "取消收藏" : "收藏"}
    >
      <svg
        class="w-5 h-5"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d={STAR_PATH}
          fill={favorited() ? "currentColor" : "none"}
          stroke="currentColor"
          stroke-width={favorited() ? "0" : "1.5"}
          class={favorited() ? "text-amber-400" : "text-slate-300 hover:text-amber-400"}
        />
      </svg>
    </button>
  );
}
