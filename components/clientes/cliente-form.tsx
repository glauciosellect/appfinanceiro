'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Cliente, ClienteFormData } from '@/types'
import {
  maskCPF,
  maskCNPJ,
  maskPhone,
  maskCEP,
  validateCPF,
  validateCNPJ,
  buscarCEP,
} from '@/lib/masks'

const schema = z
  .object({
    tipo: z.enum(['pessoa_fisica', 'pessoa_juridica']),
    nome: z.string().min(3, 'Mínimo 3 caracteres'),
    cpf_cnpj: z.string().optional(),
    inscricao_estadual: z.string().optional(),
    telefone: z.string().optional(),
    email: z.union([z.string().email('E-mail inválido'), z.literal('')]).optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    observacoes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cpf_cnpj && data.cpf_cnpj.length > 0) {
      const digits = data.cpf_cnpj.replace(/\D/g, '')
      if (data.tipo === 'pessoa_fisica' && !validateCPF(data.cpf_cnpj)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CPF inválido', path: ['cpf_cnpj'] })
      }
      if (data.tipo === 'pessoa_juridica' && digits.length > 0 && !validateCNPJ(data.cpf_cnpj)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CNPJ inválido', path: ['cpf_cnpj'] })
      }
    }
  })

type FormValues = z.infer<typeof schema>

interface ClienteFormProps {
  initial?: Cliente
  onSubmit: (data: ClienteFormData) => Promise<void>
  onCancel: () => void
}

const ESTADOS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
]

async function buscarCNPJ(cnpj: string) {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  if (!res.ok) return null
  return res.json()
}

export function ClienteForm({ initial, onSubmit, onCancel }: ClienteFormProps) {
  const [loading, setLoading] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false)
  const [cnpjErro, setCnpjErro] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: initial?.tipo ?? 'pessoa_fisica',
      nome: initial?.nome ?? '',
      cpf_cnpj: initial?.cpf_cnpj ?? '',
      inscricao_estadual: initial?.inscricao_estadual ?? '',
      telefone: initial?.telefone ?? '',
      email: initial?.email ?? '',
      cep: initial?.cep ?? '',
      endereco: initial?.endereco ?? '',
      numero: initial?.numero ?? '',
      complemento: initial?.complemento ?? '',
      bairro: initial?.bairro ?? '',
      cidade: initial?.cidade ?? '',
      estado: initial?.estado ?? '',
      observacoes: initial?.observacoes ?? '',
    },
  })

  const tipo = watch('tipo')
  const cepValue = watch('cep')
  const cnpjValue = watch('cpf_cnpj')

  useEffect(() => {
    if (tipo !== 'pessoa_juridica') return
    const digits = (cnpjValue ?? '').replace(/\D/g, '')
    if (digits.length !== 14) return
    setBuscandoCNPJ(true)
    setCnpjErro(null)
    buscarCNPJ(digits).then((data) => {
      if (data) {
        if (data.razao_social) setValue('nome', data.razao_social)
        if (data.ddd_telefone_1) {
          const tel = data.ddd_telefone_1.replace(/\D/g, '')
          setValue('telefone', maskPhone(tel))
        }
        if (data.email) setValue('email', data.email.toLowerCase())
        if (data.cep) setValue('cep', maskCEP(data.cep.replace(/\D/g, '')))
        if (data.logradouro) setValue('endereco', data.logradouro)
        if (data.numero) setValue('numero', data.numero)
        if (data.complemento) setValue('complemento', data.complemento)
        if (data.bairro) setValue('bairro', data.bairro)
        if (data.municipio) setValue('cidade', data.municipio)
        if (data.uf) setValue('estado', data.uf)
      } else {
        setCnpjErro('CNPJ não encontrado na Receita Federal')
      }
      setBuscandoCNPJ(false)
    }).catch(() => {
      setCnpjErro('Erro ao consultar CNPJ')
      setBuscandoCNPJ(false)
    })
  }, [cnpjValue, tipo, setValue])

  useEffect(() => {
    const digits = (cepValue ?? '').replace(/\D/g, '')
    if (digits.length === 8) {
      setBuscandoCEP(true)
      buscarCEP(digits).then((addr) => {
        if (addr) {
          setValue('endereco', addr.logradouro)
          setValue('bairro', addr.bairro)
          setValue('cidade', addr.localidade)
          setValue('estado', addr.uf)
        }
        setBuscandoCEP(false)
      })
    }
  }, [cepValue, setValue])

  async function handleFormSubmit(values: FormValues) {
    setLoading(true)
    try {
      await onSubmit(values as ClienteFormData)
    } finally {
      setLoading(false)
    }
  }

  const field = (name: keyof FormValues) => ({
    ...register(name),
    id: name,
    className: 'w-full',
  })

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Tipo */}
      <div className="flex gap-4">
        {(['pessoa_fisica', 'pessoa_juridica'] as const).map((t) => (
          <label key={t} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              value={t}
              {...register('tipo')}
              className="accent-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">
              {t === 'pessoa_fisica' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </span>
          </label>
        ))}
      </div>

      {/* Nome */}
      <div>
        <Label htmlFor="nome">{tipo === 'pessoa_fisica' ? 'Nome Completo' : 'Razão Social'}</Label>
        <Input {...field('nome')} placeholder="Nome" />
        {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CPF / CNPJ */}
        <div>
          <Label htmlFor="cpf_cnpj">
            {tipo === 'pessoa_fisica' ? 'CPF' : 'CNPJ'}
            {buscandoCNPJ && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
          </Label>
          <Input
            {...register('cpf_cnpj')}
            id="cpf_cnpj"
            placeholder={tipo === 'pessoa_fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
            onChange={(e) => {
              setCnpjErro(null)
              const masked =
                tipo === 'pessoa_fisica' ? maskCPF(e.target.value) : maskCNPJ(e.target.value)
              setValue('cpf_cnpj', masked)
            }}
          />
          {errors.cpf_cnpj && <p className="text-xs text-red-500 mt-1">{errors.cpf_cnpj.message}</p>}
          {cnpjErro && <p className="text-xs text-red-500 mt-1">{cnpjErro}</p>}
        </div>

        {/* Telefone */}
        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            {...register('telefone')}
            id="telefone"
            placeholder="(00) 00000-0000"
            onChange={(e) => setValue('telefone', maskPhone(e.target.value))}
          />
        </div>
      </div>

      {/* Inscrição Estadual — apenas Pessoa Jurídica */}
      {tipo === 'pessoa_juridica' && (
        <div>
          <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
          <Input
            {...field('inscricao_estadual')}
            placeholder="Número da IE ou ISENTO"
          />
        </div>
      )}

      {/* E-mail */}
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input {...field('email')} type="email" placeholder="email@exemplo.com" />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>

      {/* CEP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="cep">CEP {buscandoCEP && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</Label>
          <Input
            {...register('cep')}
            id="cep"
            placeholder="00000-000"
            onChange={(e) => setValue('cep', maskCEP(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input {...field('endereco')} placeholder="Rua, Av..." />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="numero">Número</Label>
          <Input {...field('numero')} placeholder="Nº" />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <Label htmlFor="complemento">Complemento</Label>
          <Input {...field('complemento')} placeholder="Apto, sala..." />
        </div>
        <div>
          <Label htmlFor="bairro">Bairro</Label>
          <Input {...field('bairro')} placeholder="Bairro" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input {...field('cidade')} placeholder="Cidade" />
        </div>
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Select
            value={watch('estado') ?? ''}
            onValueChange={(v) => setValue('estado', v)}
          >
            <SelectTrigger id="estado">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_BR.map((uf) => (
                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Observações */}
      <div>
        <Label htmlFor="observacoes">Observações</Label>
        <textarea
          {...register('observacoes')}
          id="observacoes"
          rows={3}
          placeholder="Informações adicionais..."
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {initial ? 'Salvar Alterações' : 'Criar Cliente'}
        </Button>
      </div>
    </form>
  )
}
