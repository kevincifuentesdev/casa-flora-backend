import type {
    DietPreference,
    FavoriteMoment,
    PaymentMethod,
    PaymentMethodType,
    SpiceTolerance,
    User,
    UserAddress,
} from "../models/user.js";

export interface UpdateUserProfileInput {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    username?: string;
    onboardingCompleted?: boolean;
    dietPreference?: DietPreference | null;
    spiceTolerance?: SpiceTolerance | null;
    favoriteMoment?: FavoriteMoment | null;
}

export interface CreateUserAddressInput {
    label: string;
    addressLine: string;
    neighborhood: string;
    city?: string;
    details?: string | null;
    isDefault?: boolean;
}

export interface CreatePaymentMethodInput {
    type: PaymentMethodType;
    brand: string;
    lastFour?: string | null;
    holderName?: string | null;
    isDefault?: boolean;
}

export interface CompleteOnboardingInput {
    address?: CreateUserAddressInput;
    paymentMethod?: CreatePaymentMethodInput;
    dietPreference?: DietPreference | null;
    spiceTolerance?: SpiceTolerance | null;
    favoriteMoment?: FavoriteMoment | null;
}

export interface IUserRepository {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    updateProfile(id: string, input: UpdateUserProfileInput): Promise<User>;
    addAddress(userId: string, input: CreateUserAddressInput): Promise<UserAddress>;
    removeAddress(userId: string, addressId: string): Promise<void>;
    addPaymentMethod(userId: string, input: CreatePaymentMethodInput): Promise<PaymentMethod>;
    removePaymentMethod(userId: string, paymentMethodId: string): Promise<void>;
    saveOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User>;
}
