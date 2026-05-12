import { useRef, useEffect, useState, useCallback } from "react";
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions,
} from "react-native";

const ITEM_H = 52;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2 items of padding each side

const MONTHS_PT = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

type Item = { label: string; value: number };

interface WheelColumnProps {
  items: Item[];
  selected: number;
  onChange: (value: number) => void;
  width: number;
  colors: any;
}

function WheelColumn({ items, selected, onChange, width, colors }: WheelColumnProps) {
  const ref = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  const selectedIndex = Math.max(0, items.findIndex((i) => i.value === selected));

  useEffect(() => {
    if (!isScrolling.current) {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }
  }, [selectedIndex]);

  const commit = useCallback((y: number) => {
    isScrolling.current = false;
    const index = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    if (items[index]?.value !== selected) onChange(items[index].value);
  }, [items, selected, onChange]);

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: "hidden" }}>
      <ScrollView
        ref={ref}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => commit(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: ITEM_H * PAD }}
      >
        {items.map((item, index) => {
          const dist = Math.abs(index - selectedIndex);
          return (
            <View key={item.value} style={{ height: ITEM_H, justifyContent: "center", alignItems: "center", width }}>
              <Text style={{
                fontSize: dist === 0 ? 21 : 16,
                fontWeight: dist === 0 ? "600" : "400",
                opacity: dist === 0 ? 1 : Math.max(0.18, 1 - dist * 0.32),
                color: colors.foreground,
              }}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Selection indicator */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: "center" }]}>
        <View style={{ height: ITEM_H, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.muted }} />
      </View>
    </View>
  );
}

export interface DrumRollDatePickerProps {
  visible: boolean;
  value?: Date | null;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  onClear?: () => void;
  colors: any;
  title?: string;
}

export function DrumRollDatePicker({
  visible, value, onConfirm, onCancel, onClear, colors,
  title = "Definir data e hora",
}: DrumRollDatePickerProps) {
  const now = new Date();
  const seed = value ?? now;

  const [day, setDay] = useState(seed.getDate());
  const [month, setMonth] = useState(seed.getMonth());
  const [year, setYear] = useState(seed.getFullYear());
  const [hour, setHour] = useState(seed.getHours());
  const [minute, setMinute] = useState(seed.getMinutes());

  useEffect(() => {
    if (visible) {
      const d = value ?? new Date();
      setDay(d.getDate()); setMonth(d.getMonth()); setYear(d.getFullYear());
      setHour(d.getHours()); setMinute(d.getMinutes());
    }
  }, [visible, value]);

  // Clamp day when month/year changes
  useEffect(() => {
    const max = daysInMonth(month, year);
    if (day > max) setDay(max);
  }, [month, year]);

  const currentYear = now.getFullYear();
  const yearItems: Item[] = range(currentYear - 1, currentYear + 10).map((v) => ({ value: v, label: String(v) }));
  const monthItems: Item[] = MONTHS_PT.map((label, index) => ({ label, value: index }));
  const dayItems: Item[] = range(1, daysInMonth(month, year)).map((v) => ({ value: v, label: String(v).padStart(2, "0") }));
  const hourItems: Item[] = range(0, 23).map((v) => ({ value: v, label: String(v).padStart(2, "0") }));
  const minuteItems: Item[] = range(0, 59).map((v) => ({ value: v, label: String(v).padStart(2, "0") }));

  const { width: screenW } = Dimensions.get("window");
  const sheetW = screenW - 48; // overlay horizontal padding
  const contentW = sheetW - 48; // sheet horizontal padding
  const dateW = contentW * 0.62;
  const timeW = contentW * 0.34;
  const dayW = Math.floor(dateW * 0.26);
  const monthW = Math.floor(dateW * 0.40);
  const yearW = Math.floor(dateW * 0.34);
  const colonW = 14;
  const halfTimeW = Math.floor((timeW - colonW) / 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>

          <View style={s.wheelsRow}>
            {/* Date: day | month | year */}
            <View style={{ flexDirection: "row" }}>
              <WheelColumn items={dayItems} selected={day} onChange={setDay} width={dayW} colors={colors} />
              <WheelColumn items={monthItems} selected={month} onChange={setMonth} width={monthW} colors={colors} />
              <WheelColumn items={yearItems} selected={year} onChange={setYear} width={yearW} colors={colors} />
            </View>

            {/* Gap */}
            <View style={{ width: contentW * 0.04 }} />

            {/* Time: hour : minute */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <WheelColumn items={hourItems} selected={hour} onChange={setHour} width={halfTimeW} colors={colors} />
              <Text style={[s.colon, { color: colors.foreground, width: colonW }]}>:</Text>
              <WheelColumn items={minuteItems} selected={minute} onChange={setMinute} width={halfTimeW} colors={colors} />
            </View>
          </View>

          <View style={[s.buttons, { borderTopColor: colors.border }]}>
            {onClear && (
              <TouchableOpacity onPress={onClear} style={s.btn}>
                <Text style={[s.btnText, { color: colors.primaryDark }]}>Limpar</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onCancel} style={s.btn}>
              <Text style={[s.btnText, { color: colors.primaryDark }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(new Date(year, month, day, hour, minute, 0, 0))} style={s.btn}>
              <Text style={[s.btnText, s.btnConfirm, { color: colors.primaryDark }]}>Definir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    width: "100%",
    borderRadius: 20,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  wheelsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colon: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "500",
  },
  btnConfirm: {
    fontWeight: "700",
  },
});
