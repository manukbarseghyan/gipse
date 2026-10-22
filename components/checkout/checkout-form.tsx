"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CreditCard, Loader2, Lock, Truck } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { OrderSummary } from "@/components/cart/cart-view";
import { useCartValidation } from "@/components/cart/use-cart-validation";
import { ProductImage } from "@/components/product/product-image";
import { ButtonLink } from "@/components/ui/button";
import { describedBy, Field, Input, Textarea } from "@/components/ui/form";
import { Notice, Skeleton } from "@/components/ui/misc";
import { placeOrderAction } from "@/lib/actions/storefront";
import { emptyCart, orderableItems } from "@/lib/cart/cart";
import { updateCart } from "@/lib/cart/store";
import { formatAmd } from "@/lib/format";
import { localizedFromMap } from "@/lib/i18n/localized";
import { calculateTotals } from "@/lib/pricing";
import { customerSchema, type CustomerFormValues } from "@/lib/validation/checkout";
import { cn } from "@/lib/utils";

type FormError =
  | "totalsUpdated"
  | "errorGeneric"
  | "errorRateLimited"
  | "errorUnavailable"
  | "errorInsufficientStock"
  | "errorInvalid"
  | "errorNotConfigured"
  | "paymentCardUnavailable";

export function CheckoutForm() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { cart, hydrated, status, delivery, cardPaymentsEnabled, revalidate } = useCartValidation();
  const [formError, setFormError] = useState<FormError | null>(null);
  const [serverTotals, setServerTotals] = useState<{ subtotalAmd: number; deliveryFeeAmd: number; totalAmd: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  const items = orderableItems(cart);
  const signature = items.map((line) => `${line.productId}:${line.quantity}:${line.priceAmd}`).join("|");
  // One idempotency key per cart snapshot: a double click or a network retry of
  // the same cart returns the same order instead of creating a duplicate.
  const idempotency = useRef<{ signature: string; key: string } | null>(null);
  const idempotencyKeyFor = (current: string) => {
    if (idempotency.current?.signature !== current) idempotency.current = { signature: current, key: crypto.randomUUID() };
    return idempotency.current.key;
  };

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { paymentMethod: "cash_on_delivery" },
    mode: "onTouched",
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const message = (code?: string) => (code ? t.dynamic(`validation.${code}`, t("validation.invalid")) : undefined);

  if (!hydrated) return <Skeleton className="h-[32rem] w-full rounded-[var(--radius-card)]" />;

  if (items.length === 0 && !completed) {
    return (
      <div className="rounded-[var(--radius-card)] bg-white px-6 py-16 text-center shadow-[var(--shadow-soft)]">
        <p className="text-lg text-ink">{t("checkout.emptyCart")}</p>
        <ButtonLink href={`/${locale}/products`} className="mt-8">
          {t("cart.emptyCta")}
        </ButtonLink>
      </div>
    );
  }

  const expected =
    delivery !== null
      ? calculateTotals(items.map((line) => ({ unitPriceAmd: line.priceAmd, quantity: line.quantity })), delivery)
      : serverTotals;

  const onValid = (values: CustomerFormValues) => {
    setFormError(null);
    if (values.paymentMethod === "card" && !cardPaymentsEnabled) {
      setFormError("paymentCardUnavailable");
      return;
    }
    startTransition(async () => {
      const result = await placeOrderAction({
        ...values,
        idempotencyKey: idempotencyKeyFor(signature),
        locale,
        items: items.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        expectedTotalAmd: expected?.totalAmd ?? 0,
      }).catch(() => null);

      if (!result) {
        setFormError("errorGeneric");
        return;
      }

      if (result.ok) {
        setCompleted(true);
        // Clear the cart only now that the order is safely stored.
        updateCart(() => emptyCart());
        if (result.redirectUrl) {
          window.location.assign(result.redirectUrl);
        } else {
          router.push(`/${locale}/order/${result.publicToken}${result.paymentError ? "?payment=unavailable" : ""}`);
        }
        return;
      }

      switch (result.error) {
        case "price_changed":
          setServerTotals(result.totals);
          await revalidate();
          setFormError("totalsUpdated");
          break;
        case "product_unavailable":
          await revalidate();
          setFormError("errorUnavailable");
          break;
        case "insufficient_stock":
          await revalidate();
          setFormError("errorInsufficientStock");
          break;
        case "invalid_input":
          for (const [field, code] of Object.entries(result.fieldErrors)) {
            if (field in values) setError(field as keyof CustomerFormValues, { message: code });
          }
          setFormError("errorInvalid");
          break;
        case "rate_limited":
          setFormError("errorRateLimited");
          break;
        case "card_unavailable":
          setFormError("paymentCardUnavailable");
          break;
        case "not_configured":
          setFormError("errorNotConfigured");
          break;
        default:
          setFormError("errorGeneric");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-6">
        {formError ? (
          <Notice tone={formError === "totalsUpdated" ? "info" : "error"} role="alert">
            {t(`checkout.${formError}`)}
          </Notice>
        ) : null}

        <fieldset className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <legend className="sr-only">{t("checkout.contactSection")}</legend>
          <h2 aria-hidden className="mb-5 text-2xl text-ink">
            {t("checkout.contactSection")}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="customerName" label={t("checkout.name")} error={message(errors.customerName?.message)} className="sm:col-span-2">
              <Input
                id="customerName"
                autoComplete="name"
                aria-invalid={Boolean(errors.customerName)}
                aria-describedby={describedBy("customerName", errors.customerName?.message)}
                {...register("customerName")}
              />
            </Field>
            <Field
              id="customerPhone"
              label={t("checkout.phone")}
              hint={t("checkout.phoneHint")}
              error={message(errors.customerPhone?.message)}
              className="sm:col-span-2"
            >
              <Input
                id="customerPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={Boolean(errors.customerPhone)}
                aria-describedby={describedBy("customerPhone", errors.customerPhone?.message, true)}
                {...register("customerPhone")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <legend className="sr-only">{t("checkout.deliverySection")}</legend>
          <h2 aria-hidden className="mb-5 text-2xl text-ink">
            {t("checkout.deliverySection")}
          </h2>
          <div className="mb-5 flex gap-3 rounded-2xl bg-cream/70 p-4 text-sm">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="font-medium text-ink">{t("checkout.deliveryMethod")}</p>
              <p className="mt-0.5 text-muted">{t("checkout.deliveryMethodText")}</p>
            </div>
          </div>
          <div className="grid gap-5">
            <Field id="deliveryAddress" label={t("checkout.address")} hint={t("checkout.addressHint")} error={message(errors.deliveryAddress?.message)}>
              <Textarea
                id="deliveryAddress"
                rows={2}
                autoComplete="street-address"
                aria-invalid={Boolean(errors.deliveryAddress)}
                aria-describedby={describedBy("deliveryAddress", errors.deliveryAddress?.message, true)}
                {...register("deliveryAddress")}
              />
            </Field>
            <Field
              id="deliveryNotes"
              label={t("checkout.deliveryNotes")}
              optionalLabel={t("checkout.optional")}
              hint={t("checkout.deliveryNotesHint")}
              error={message(errors.deliveryNotes?.message)}
            >
              <Textarea
                id="deliveryNotes"
                rows={2}
                aria-invalid={Boolean(errors.deliveryNotes)}
                aria-describedby={describedBy("deliveryNotes", errors.deliveryNotes?.message, true)}
                {...register("deliveryNotes")}
              />
            </Field>
            <Field
              id="customerNote"
              label={t("checkout.customerNote")}
              optionalLabel={t("checkout.optional")}
              hint={t("checkout.customerNoteHint")}
              error={message(errors.customerNote?.message)}
            >
              <Textarea
                id="customerNote"
                rows={3}
                aria-invalid={Boolean(errors.customerNote)}
                aria-describedby={describedBy("customerNote", errors.customerNote?.message, true)}
                {...register("customerNote")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <legend className="mb-5 font-display text-2xl text-ink">{t("checkout.paymentSection")}</legend>
          <div className="grid gap-3">
            <PaymentOption
              value="cash_on_delivery"
              checked={paymentMethod === "cash_on_delivery"}
              icon={<Banknote className="h-5 w-5" aria-hidden />}
              title={t("checkout.paymentCod")}
              text={t("checkout.paymentCodText")}
              registration={register("paymentMethod")}
            />
            <PaymentOption
              value="card"
              checked={paymentMethod === "card"}
              disabled={!cardPaymentsEnabled}
              icon={<CreditCard className="h-5 w-5" aria-hidden />}
              title={t("checkout.paymentCard")}
              text={cardPaymentsEnabled ? t("checkout.paymentCardText") : t("checkout.paymentCardUnavailable")}
              registration={register("paymentMethod")}
            />
          </div>
        </fieldset>
      </div>

      <OrderSummary items={items} delivery={delivery} totalsOverride={delivery ? null : serverTotals} title={t("checkout.summarySection")}>
        <ul className="mt-5 space-y-3 border-t border-sand pt-5">
          {items.map((line) => (
            <li key={line.productId} className="flex items-center gap-3 text-sm">
              <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">
                <ProductImage path={line.image} alt="" sizes="48px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">
                  {localizedFromMap({ hy: line.name.hy, ru: line.name.ru ?? undefined, en: line.name.en ?? undefined }, locale)}
                </span>
                <span className="text-muted tabular-nums">
                  {line.quantity} × {formatAmd(line.priceAmd)}
                </span>
              </span>
              <span className="text-ink tabular-nums">{formatAmd(line.quantity * line.priceAmd)}</span>
            </li>
          ))}
        </ul>
        <button
          type="submit"
          disabled={isPending || completed || status === "checking"}
          className="mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink px-8 text-base font-medium text-ivory transition-colors hover:bg-accent-dark disabled:opacity-60"
        >
          {isPending || completed ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
          {isPending || completed ? t("checkout.placing") : t("checkout.placeOrder")}
        </button>
        <p className="mt-3 text-center text-xs text-muted">{t("checkout.privacyNote")}</p>
        <p className="mt-2 text-center">
          <Link href={`/${locale}/cart`} className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
            ← {t("nav.cart")}
          </Link>
        </p>
      </OrderSummary>
    </form>
  );
}

function PaymentOption({
  value,
  checked,
  disabled,
  icon,
  title,
  text,
  registration,
}: {
  value: "cash_on_delivery" | "card";
  checked: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  registration: ReturnType<ReturnType<typeof useForm<CustomerFormValues>>["register"]>;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-4 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30",
        checked ? "border-ink bg-cream/40" : "border-sand hover:border-stone",
        disabled && "cursor-not-allowed opacity-60 hover:border-sand",
      )}
    >
      <input type="radio" value={value} disabled={disabled} className="mt-1 h-4 w-4 accent-ink" {...registration} />
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark">{icon}</span>
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{text}</span>
      </span>
    </label>
  );
}
