// Credenciais DEMONSTRATIVAS (projeto acadêmico). Tratar como públicas; não reutilizar em outros serviços.
export const demoUsers = [
  {
    name: "GoMob Passenger",
    email: "usuario@gomob.demo",
    password: "GoMobUser2026!",
    role: "USER",
  },
  {
    name: "GoMob Administrator",
    email: "admin@gomob.demo",
    password: "GoMobAdmin2026!",
    role: "ADMIN",
  },
  {
    name: "Cliente",
    email: "cliente@gmail.com",
    password: "cliente",
    role: "USER",
  },
  {
    name: "Admin",
    email: "admin@gmail.com",
    password: "admin",
    role: "ADMIN",
  },
] as const;
