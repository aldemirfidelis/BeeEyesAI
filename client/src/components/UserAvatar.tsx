type UserAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

export function UserAvatar({ name, avatarUrl, className = "w-9 h-9", fallbackClassName = "bg-primary/20 text-foreground" }: UserAvatarProps) {
  const initial = name?.[0]?.toUpperCase() || "?";

  return (
    <div className={`${className} rounded-full overflow-hidden flex items-center justify-center shrink-0 ${avatarUrl ? "bg-secondary" : fallbackClassName}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`Foto de ${name}`} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="text-sm font-bold">{initial}</span>
      )}
    </div>
  );
}
