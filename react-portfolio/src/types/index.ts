// ============================================================================
// STICKER TYPES
// ============================================================================

export interface Position {
  x: number;
  y: number;
  rot?: number;
}

export interface StickerDimensions {
  w: number;
  h: number;
}

export interface StickerPosition extends Position, StickerDimensions {}

export interface StickerProps {
  id: string;
  initial: Position;
  zBase?: number;
  children?: React.ReactNode;
  onClick?: (e: React.PointerEvent | React.MouseEvent) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;
  title?: string;
  peelColor?: string;
  className?: string;
  style?: React.CSSProperties;
  entranceDelay?: number;
  scale?: number;
}

export interface PhotoStickerProps extends Omit<StickerProps, 'children'> {
  src: string;
  w?: number;
  h?: number;
  shape?: 'rounded' | 'circle' | 'sharp';
  noBorder?: boolean;
}

export interface ImageStickerProps extends Omit<StickerProps, 'children'> {
  src: string;
  size?: number;
  bg?: string;
  pad?: number;
  radius?: number;
}

export interface WordStickerProps extends Omit<StickerProps, 'children'> {
  text: string;
  bg?: string;
  fg?: string;
  font?: string;
  fontSize?: number;
  padX?: number;
  padY?: number;
  rotate?: number;
  shape?: 'rect' | 'pill';
}

export interface AirPodsStickerProps extends StickerProps {
  onPlay?: () => void;
}

export interface CoffeeMachineStickerProps extends StickerProps {
  onBrew?: () => void;
}

// ============================================================================
// CARD TYPES
// ============================================================================

export type CardKind = 'intro' | 'bullets' | 'quote' | 'cta';

export interface BaseCard {
  kind: CardKind;
}

export interface IntroCard extends BaseCard {
  kind: 'intro';
  body: string;
  foot: string;
}

export interface BulletsCard extends BaseCard {
  kind: 'bullets';
  title: string;
  items: string[];
}

export interface QuoteCard extends BaseCard {
  kind: 'quote';
  body: string;
  foot: string;
}

export interface CtaCard extends BaseCard {
  kind: 'cta';
  title: string;
  body: string;
  foot: string;
}

export type Card = IntroCard | BulletsCard | QuoteCard | CtaCard;

// ============================================================================
// PROJECT TYPES
// ============================================================================

export interface Project {
  id: string;
  name: string;
  subtitle?: string;
  tagline: string;
  color: string;
  icon: string;
  period: string;
  role: string;
  description: string;
  techStack: string[];
  rotation?: number;
}

// ============================================================================
// MODAL TYPES
// ============================================================================

export type ModalType =
  | 'phone'
  | 'music'
  | 'terrapin'
  | 'charminar'
  | 'dc'
  | 'travel'
  | 'beach'
  | 'pickleball'
  | 'camera'
  | 'coffee'
  | 'gym'
  | 'portrait'
  | 'work'
  | 'stoic'
  | null;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  color?: string;
  noAnimation?: boolean;
}

// ============================================================================
// STOIC QUOTE TYPE
// ============================================================================

export interface StoicQuote {
  text: string;
  author: string;
}

// ============================================================================
// LAYOUT TYPES
// ============================================================================

export interface Dimensions {
  w: number;
  h: number;
}

export interface OrbitalPositions {
  [key: string]: Position;
}

// ============================================================================
// DRAG STATE
// ============================================================================

export interface DragState {
  active: boolean;
  dx: number;
  dy: number;
}

export interface DragRef {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  pointerId: number | null;
}
